import "server-only";

import { QualificationService } from "@/application/qualification/qualification-service";
import {
  hardFilterResultsForPrefilter,
  prefilterFromDiscoveryMetadata,
} from "@/domain/leads/discovery-prefilter";
import type { SaveLeadInput } from "@/domain/leads/lead";
import {
  employeeCountFromMetadata,
  industryFromMetadata,
  locationFromMetadata,
} from "@/domain/leads/lead";
import { AppError } from "@/domain/shared/errors";
import { isResearchableDomain } from "@/domain/shared/normalize";
import { payableCost } from "@/domain/runs/spend";
import { ApifyDiscoveryProvider } from "@/infrastructure/apify/apify-discovery-provider";
import type { CompanyDiscoveryProvider } from "@/infrastructure/apify/discovery-provider";
import { CompanyRepository } from "@/infrastructure/supabase/repositories/company-repository";
import { IcpRepository } from "@/infrastructure/supabase/repositories/icp-repository";
import { RunEventRepository } from "@/infrastructure/supabase/repositories/run-event-repository";
import { RunRepository } from "@/infrastructure/supabase/repositories/run-repository";
import { ToolCallRepository } from "@/infrastructure/supabase/repositories/tool-call-repository";
import type {
  DiscoveredCompanyRow,
  IcpCriteria,
  RunRow,
} from "@/infrastructure/supabase/types";

export type PrefilteredCompany = {
  company_id: string;
  company_name: string;
  reason: string;
};

export interface DiscoverCompaniesResult {
  companies: DiscoveredCompanyRow[];
  prefiltered: PrefilteredCompany[];
  externalReference?: string;
  costUsd?: number;
}

/**
 * Per-call discovery chunk size. Not agent-configurable — TOOLS-CONTRACT.md
 * section 10: "The agent should not provide an arbitrary discovery limit."
 */
const DISCOVERY_CHUNK_SIZE = 10;

/** After this many failed discover_companies calls, stop paying Apify. */
const MAX_DISCOVERY_PROVIDER_FAILURES = 2;

export class DiscoveryService {
  constructor(
    private readonly runs = new RunRepository(),
    private readonly companies = new CompanyRepository(),
    private readonly events = new RunEventRepository(),
    private readonly provider: CompanyDiscoveryProvider = new ApifyDiscoveryProvider(),
    private readonly icps = new IcpRepository(),
    private readonly qualification = new QualificationService(),
    private readonly toolCalls = new ToolCallRepository(),
  ) {}

  async discoverCompanies(
    run: RunRow,
    query: string,
  ): Promise<DiscoverCompaniesResult> {
    const runId = run.id;
    if (run.status !== "researching") {
      throw new AppError(
        "RUN_NOT_ACTIVE",
        "This run is not currently researching.",
      );
    }
    if (run.qualified_count >= run.qualified_target) {
      throw new AppError(
        "TARGET_ALREADY_REACHED",
        "The qualified lead target has already been reached.",
      );
    }

    const failedDiscoveries = await this.toolCalls.countFailed(
      runId,
      "discover_companies",
    );
    if (failedDiscoveries >= MAX_DISCOVERY_PROVIDER_FAILURES) {
      throw new AppError(
        "PROVIDER_ERROR",
        "Company discovery has failed too many times for this run. Stop discovering and qualify companies already found.",
        false,
      );
    }

    let reserved = 0;
    let persistedCount = 0;
    let result: Awaited<ReturnType<CompanyDiscoveryProvider["discover"]>> | undefined;
    const persisted: DiscoveredCompanyRow[] = [];

    try {
      reserved = await this.runs.reserveDiscoverySlots(
        runId,
        DISCOVERY_CHUNK_SIZE,
      );
      if (reserved <= 0) {
        throw new AppError(
          "DISCOVERY_LIMIT_EXCEEDED",
          "This run has reached its discovery limit.",
        );
      }

      await this.events.record({
        runId,
        eventType: "discovery_started",
        message: `Searching for up to ${reserved} candidate companies.`,
      });

      result = await this.provider.discover({ query, maxItems: reserved });

      for (const company of result.companies) {
        const { company: row, wasNew } = await this.companies.upsertDiscovered({
          runId,
          companyName: company.companyName,
          domain: company.domain,
          discoverySource: "apify",
          sourceUrl: company.sourceUrl,
          externalId: company.externalId,
          metadata: company.metadata,
        });
        if (wasNew) {
          persisted.push(row);
          persistedCount = persisted.length;
        }
      }
    } finally {
      const unused = reserved - persistedCount;
      if (unused > 0) {
        await this.runs.releaseDiscoverySlots(runId, unused);
      }
    }

    const approvedIcp = await this.icps.getApproved(runId);
    const researchable: DiscoveredCompanyRow[] = [];
    const prefiltered: PrefilteredCompany[] = [];

    for (const row of persisted) {
      const skip = await this.maybePrefilter(run, row, approvedIcp?.criteria);
      if (skip) {
        prefiltered.push(skip);
      } else {
        researchable.push(row);
      }
    }

    await this.events.record({
      runId,
      eventType: "discovery_completed",
      message: `Discovered ${persisted.length} new companies (${prefiltered.length} rejected before research).`,
      metadata: {
        count: persisted.length,
        prefiltered: prefiltered.length,
      },
    });

    const discoveryUsd = payableCost(result?.costUsd);
    if (discoveryUsd > 0) {
      await this.runs.addCost(runId, { discoveryUsd, agentUsd: 0 });
    }

    return {
      companies: researchable,
      prefiltered,
      externalReference: result?.externalReference,
      costUsd: result?.costUsd,
    };
  }

  private async maybePrefilter(
    run: RunRow,
    company: DiscoveredCompanyRow,
    criteria: IcpCriteria | undefined,
  ): Promise<PrefilteredCompany | null> {
    if (!isResearchableDomain(company.normalized_domain)) {
      if (criteria) {
        const saved = await this.trySaveDiscoveryDecision(run, company, criteria, {
          status: "needs_review",
          reason:
            "No public company website was present in discovery data; skipped website research.",
          dimension: null,
        });
        if (!saved) return null;
      }
      return {
        company_id: company.id,
        company_name: company.company_name,
        reason: "No public company website; marked needs_review without scraping.",
      };
    }

    if (!criteria) return null;

    const verdict = prefilterFromDiscoveryMetadata(
      criteria,
      company.raw_metadata,
    );
    if (verdict.decision !== "reject") return null;

    const saved = await this.trySaveDiscoveryDecision(run, company, criteria, {
      status: "not_qualified",
      reason: verdict.reason,
      dimension: verdict.dimension,
      evidence: verdict.evidence,
    });
    if (!saved) return null;
    return {
      company_id: company.id,
      company_name: company.company_name,
      reason: verdict.reason,
    };
  }

  private async trySaveDiscoveryDecision(
    run: RunRow,
    company: DiscoveredCompanyRow,
    criteria: IcpCriteria,
    decision: {
      status: "not_qualified" | "needs_review";
      reason: string;
      dimension: "employee_range" | "geography" | "industry" | null;
      evidence?: string;
    },
  ): Promise<boolean> {
    try {
      await this.saveDiscoveryDecision(run, company, criteria, decision);
      return true;
    } catch {
      // Leave the company researchable so a failed auto-save cannot
      // strand it with a used slot and no lead row.
      return false;
    }
  }

  private async saveDiscoveryDecision(
    run: RunRow,
    company: DiscoveredCompanyRow,
    criteria: IcpCriteria,
    decision: {
      status: "not_qualified" | "needs_review";
      reason: string;
      dimension: "employee_range" | "geography" | "industry" | null;
      evidence?: string;
    },
  ): Promise<void> {
    const metadata = company.raw_metadata;
    const input: SaveLeadInput = {
      company_id: company.id,
      qualification_status: decision.status,
      confidence_score: decision.status === "not_qualified" ? 90 : 40,
      fit_reasons: [],
      concerns: [],
      hard_filter_results: hardFilterResultsForPrefilter(
        criteria.hard_filters,
        decision.dimension,
        decision.evidence,
      ),
      qualification_reasoning: decision.reason,
      source_summary: decision.reason,
      research_metadata: {
        ...(employeeCountFromMetadata(metadata) !== null
          ? { employee_count: employeeCountFromMetadata(metadata)! }
          : {}),
        ...(industryFromMetadata(metadata)
          ? { industry: industryFromMetadata(metadata)! }
          : {}),
        ...(locationFromMetadata(metadata)
          ? { location: locationFromMetadata(metadata)! }
          : {}),
      },
    };
    await this.qualification.saveLead(run, input);
  }
}
