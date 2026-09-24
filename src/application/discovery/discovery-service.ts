import "server-only";

import { AppError } from "@/domain/shared/errors";
import { ApifyDiscoveryProvider } from "@/infrastructure/apify/apify-discovery-provider";
import type { CompanyDiscoveryProvider } from "@/infrastructure/apify/discovery-provider";
import { CompanyRepository } from "@/infrastructure/supabase/repositories/company-repository";
import { RunEventRepository } from "@/infrastructure/supabase/repositories/run-event-repository";
import { RunRepository } from "@/infrastructure/supabase/repositories/run-repository";
import type {
  DiscoveredCompanyRow,
  RunRow,
} from "@/infrastructure/supabase/types";

export interface DiscoverCompaniesResult {
  companies: DiscoveredCompanyRow[];
  externalReference?: string;
  costUsd?: number;
}

/**
 * Per-call discovery chunk size. Not agent-configurable — TOOLS-CONTRACT.md
 * section 10: "The agent should not provide an arbitrary discovery limit."
 * Deliberately small so each Apify run stays cheap and inspectable
 * (BUILD-PLAN.md section 16's "test small, then scale" default); the agent
 * simply calls discover_companies again if more candidates are still needed
 * and the run's remaining budget allows it.
 */
const DISCOVERY_CHUNK_SIZE = 10;

export class DiscoveryService {
  constructor(
    private readonly runs = new RunRepository(),
    private readonly companies = new CompanyRepository(),
    private readonly events = new RunEventRepository(),
    private readonly provider: CompanyDiscoveryProvider = new ApifyDiscoveryProvider(),
  ) {}

  /**
   * Discovers up to `requestedInternalLimit` companies, but never more than
   * the run's remaining discovery budget — enforced atomically by
   * RunRepository.reserveDiscoverySlots so two concurrent calls cannot
   * jointly exceed discovery_limit (TEST-PLAN.md LIMIT-005). The agent's
   * requested limit is only ever a ceiling on top of that, never a
   * substitute for it (TOOLS-CONTRACT.md section 12).
   *
   * `run` must already be authorization-checked by the caller (the tool
   * execution pipeline's run-authorization step) — this service trusts it
   * and focuses on business rules, not re-deriving ownership.
   */
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

    const reserved = await this.runs.reserveDiscoverySlots(
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

    let result;
    try {
      result = await this.provider.discover({ query, maxItems: reserved });
    } catch (err) {
      // The reserved slots were never used — release them so the limit
      // still reflects what actually happened.
      await this.runs.releaseDiscoverySlots(runId, reserved);
      throw err;
    }

    const persisted: DiscoveredCompanyRow[] = [];
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
      if (wasNew) persisted.push(row);
    }

    // Reconcile: only count unique, newly-persisted companies against the
    // limit (data-model.md section 15), while still having atomically
    // capped how many the provider was ever asked for.
    const unused = reserved - persisted.length;
    if (unused > 0) {
      await this.runs.releaseDiscoverySlots(runId, unused);
    }

    await this.events.record({
      runId,
      eventType: "discovery_completed",
      message: `Discovered ${persisted.length} new companies.`,
      metadata: { count: persisted.length },
    });

    return {
      companies: persisted,
      externalReference: result.externalReference,
      costUsd: result.costUsd,
    };
  }
}
