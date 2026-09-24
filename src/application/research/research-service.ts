import "server-only";

import { AppError } from "@/domain/shared/errors";
import { getResearchProvider } from "@/infrastructure/research/get-research-provider";
import type {
  ResearchedSource,
  WebsiteResearchProvider,
} from "@/infrastructure/research/research-provider";
import { CompanyRepository } from "@/infrastructure/supabase/repositories/company-repository";
import { RunEventRepository } from "@/infrastructure/supabase/repositories/run-event-repository";
import { SourceRepository } from "@/infrastructure/supabase/repositories/source-repository";
import type {
  LeadSourceRow,
  RunRow,
  SourceType,
} from "@/infrastructure/supabase/types";

/**
 * research_website and record_source are deliberately separate tools
 * (TOOLS-CONTRACT.md sections 16-25 / section 49's composition sequence):
 * research returns ephemeral evidence for the agent to read, and the agent
 * decides what's actually worth persisting via a separate record_source
 * call. This mirrors that split.
 */
export class ResearchService {
  private _provider: WebsiteResearchProvider | undefined;

  constructor(
    private readonly companies = new CompanyRepository(),
    private readonly sources = new SourceRepository(),
    private readonly events = new RunEventRepository(),
    explicitProvider?: WebsiteResearchProvider,
  ) {
    this._provider = explicitProvider;
  }

  /**
   * Lazily selects the provider on first use, not at construction — see
   * the lazy-init comments on ApifyDiscoveryProvider/FirecrawlResearchProvider.
   * getResearchProvider() reads RESEARCH_PROVIDER from the environment,
   * which must not happen merely because a module imported this class.
   */
  private get provider(): WebsiteResearchProvider {
    if (!this._provider) this._provider = getResearchProvider();
    return this._provider;
  }

  /** `run` must already be authorization-checked by the caller. Does not persist anything. */
  async researchWebsite(
    run: RunRow,
    companyId: string,
    urls?: string[],
  ): Promise<{ companyId: string; sources: ResearchedSource[] }> {
    if (run.status !== "researching") {
      throw new AppError(
        "RUN_NOT_ACTIVE",
        "This run is not currently researching.",
      );
    }

    const company = await this.companies.getOwned(companyId, run.id);

    await this.events.record({
      runId: run.id,
      eventType: "company_research_started",
      message: `Researching ${company.company_name}.`,
    });

    const result = await this.provider.research({
      // `domain` is the raw, unnormalized value a discovery provider
      // returned (may already include a protocol, e.g.
      // "http://www.acme.com") — `normalized_domain` is guaranteed to be
      // a bare hostname, which is what `https://${domain}` construction
      // in the research provider requires.
      domain: company.normalized_domain,
      urls,
    });

    await this.events.record({
      runId: run.id,
      eventType: "company_research_completed",
      message: `Researched ${company.company_name} (${result.sources.length} page${
        result.sources.length === 1 ? "" : "s"
      }).`,
    });

    return { companyId: company.id, sources: result.sources };
  }

  /** `run` must already be authorization-checked by the caller. */
  async recordSource(
    run: RunRow,
    input: {
      companyId: string;
      url: string;
      title?: string;
      sourceType: SourceType;
      summary: string;
      relevantExcerpt?: string;
      provider?: string;
    },
  ): Promise<LeadSourceRow> {
    // Confirms the company belongs to this run (throws COMPANY_NOT_FOUND otherwise).
    await this.companies.getOwned(input.companyId, run.id);

    return this.sources.recordSource({
      runId: run.id,
      companyId: input.companyId,
      url: input.url,
      title: input.title,
      sourceType: input.sourceType,
      summary: input.summary,
      relevantExcerpt: input.relevantExcerpt,
      provider: input.provider ?? "firecrawl",
    });
  }
}
