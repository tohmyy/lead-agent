import "server-only";

import { AppError } from "@/domain/shared/errors";
import {
  assertHardFilterResults,
  assertHardFiltersNotViolated,
  type SaveLeadInput,
} from "@/domain/leads/lead";
import { CompanyRepository } from "@/infrastructure/supabase/repositories/company-repository";
import { IcpRepository } from "@/infrastructure/supabase/repositories/icp-repository";
import { LeadRepository } from "@/infrastructure/supabase/repositories/lead-repository";
import { RunEventRepository } from "@/infrastructure/supabase/repositories/run-event-repository";
import { RunRepository } from "@/infrastructure/supabase/repositories/run-repository";
import { SourceRepository } from "@/infrastructure/supabase/repositories/source-repository";
import type { LeadRow, RunRow } from "@/infrastructure/supabase/types";

export interface CompanyContext {
  company: {
    name: string;
    domain: string;
    discoverySource?: string;
    discoveryMetadata: Record<string, unknown> | null;
  };
  sources: Array<{
    id: string;
    url: string;
    title?: string;
    sourceType: string;
    summary: string;
    relevantExcerpt?: string;
  }>;
  existingLead: LeadRow | null;
}

export class QualificationService {
  constructor(
    private readonly companies = new CompanyRepository(),
    private readonly sources = new SourceRepository(),
    private readonly leads = new LeadRepository(),
    private readonly icps = new IcpRepository(),
    private readonly events = new RunEventRepository(),
    private readonly runs = new RunRepository(),
  ) {}

  /** get_company_context — read-only, no invented data (TOOLS-CONTRACT.md section 26). */
  async getCompanyContext(
    run: RunRow,
    companyId: string,
  ): Promise<CompanyContext> {
    const company = await this.companies.getOwned(companyId, run.id);
    const sources = await this.sources.listForCompany(companyId);
    const existingLead = await this.leads.getByCompany(companyId, run.id);

    return {
      company: {
        name: company.company_name,
        domain: company.domain,
        discoverySource: company.discovery_source,
        discoveryMetadata: company.raw_metadata,
      },
      sources: sources.map((s) => ({
        id: s.id,
        url: s.url,
        title: s.title ?? undefined,
        sourceType: s.source_type,
        summary: s.summary,
        relevantExcerpt: s.relevant_excerpt ?? undefined,
      })),
      existingLead,
    };
  }

  /** `run` must already be authorization-checked by the caller. */
  async saveLead(run: RunRow, input: SaveLeadInput): Promise<LeadRow> {
    if (run.status !== "researching") {
      throw new AppError(
        "RUN_NOT_ACTIVE",
        "This run is not currently researching.",
      );
    }

    const company = await this.companies.getOwned(input.company_id, run.id);

    const knownSources = await this.sources.listForCompany(input.company_id);
    const knownSourceIds = new Set(knownSources.map((s) => s.id));
    for (const reason of input.fit_reasons) {
      for (const id of reason.source_ids) {
        if (!knownSourceIds.has(id)) {
          throw new AppError(
            "EVIDENCE_REQUIRED",
            "A fit reason references a source that was not recorded for this company.",
          );
        }
      }
    }

    const approvedIcp = await this.icps.getApproved(run.id);
    if (!approvedIcp) {
      throw new AppError(
        "ICP_NOT_APPROVED",
        "This run does not have an approved ICP.",
      );
    }
    assertHardFiltersNotViolated(
      input.qualification_status,
      approvedIcp.criteria,
      input.research_metadata,
    );
    assertHardFilterResults({
      status: input.qualification_status,
      approvedFilters: approvedIcp.criteria.hard_filters,
      results: input.hard_filter_results,
    });

    const wasAlreadyQualified =
      (await this.leads.getByCompany(input.company_id, run.id))
        ?.qualification_status === "qualified";

    const { lead } = await this.leads.upsert({
      runId: run.id,
      companyId: input.company_id,
      companyName: company.company_name,
      domain: company.domain,
      data: input,
    });

    if (input.qualification_status === "qualified" && !wasAlreadyQualified) {
      await this.runs.incrementCounts(run.id, { qualified_count: 1 });
      await this.events.record({
        runId: run.id,
        eventType: "lead_qualified",
        message: `${company.company_name} qualified.`,
        metadata: { confidence_score: input.confidence_score },
      });
    } else if (
      input.qualification_status !== "qualified" &&
      !wasAlreadyQualified
    ) {
      await this.runs.incrementCounts(run.id, { rejected_count: 1 });
      await this.events.record({
        runId: run.id,
        eventType: "lead_rejected",
        message: `${company.company_name} was not qualified: ${input.qualification_reasoning.slice(0, 140)}`,
      });
    }

    return lead;
  }
}
