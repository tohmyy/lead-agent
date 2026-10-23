import "server-only";

import { AppError, isAppError } from "@/domain/shared/errors";
import { isResearchableDomain, normalizeUrl } from "@/domain/shared/normalize";
import { getResearchProvider } from "@/infrastructure/research/get-research-provider";
import type {
  ResearchedSource,
  WebsiteResearchProvider,
} from "@/infrastructure/research/research-provider";
import { defaultResearchUrls } from "@/infrastructure/research/research-provider";
import { CompanyRepository } from "@/infrastructure/supabase/repositories/company-repository";
import {
  cacheRowToSource,
  ResearchCacheRepository,
} from "@/infrastructure/supabase/repositories/research-cache-repository";
import { RunEventRepository } from "@/infrastructure/supabase/repositories/run-event-repository";
import { SourceRepository } from "@/infrastructure/supabase/repositories/source-repository";
import type { LeadSourceRow, RunRow } from "@/infrastructure/supabase/types";

export class ResearchService {
  private _provider: WebsiteResearchProvider | undefined;

  constructor(
    private readonly companies = new CompanyRepository(),
    private readonly sources = new SourceRepository(),
    private readonly events = new RunEventRepository(),
    explicitProvider?: WebsiteResearchProvider,
    private readonly cache = new ResearchCacheRepository(),
  ) {
    this._provider = explicitProvider;
  }

  /**
   * Lazily selects the provider on first use, not at construction — see
   * the lazy-init comments on ApifyDiscoveryProvider/FirecrawlResearchProvider.
   */
  private get provider(): WebsiteResearchProvider {
    if (!this._provider) this._provider = getResearchProvider();
    return this._provider;
  }

  /** `run` must already be authorization-checked by the caller. */
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

    if (!isResearchableDomain(company.normalized_domain)) {
      await this.events.record({
        runId: run.id,
        eventType: "company_research_failed",
        message: `${company.company_name} has no public website to research.`,
      });
      throw new AppError(
        "PROVIDER_ERROR",
        "This company has no public website to research. Call save_lead with needs_review instead of scraping.",
        false,
      );
    }

    await this.events.record({
      runId: run.id,
      eventType: "company_research_started",
      message: `Researching ${company.company_name}.`,
    });

    try {
      const sources = await this.collectSources(
        company.normalized_domain,
        companyId,
        urls,
      );

      await this.events.record({
        runId: run.id,
        eventType: "company_research_completed",
        message: `Researched ${company.company_name} (${sources.length} page${
          sources.length === 1 ? "" : "s"
        }).`,
      });

      return { companyId: company.id, sources };
    } catch (err) {
      const message = isAppError(err)
        ? err.message
        : "Website research failed.";
      await this.events.record({
        runId: run.id,
        eventType: "company_research_failed",
        message: `Research failed for ${company.company_name}: ${message.slice(0, 180)}`,
      });
      throw err;
    }
  }

  private async collectSources(
    domain: string,
    companyId: string,
    urls?: string[],
  ): Promise<ResearchedSource[]> {
    const requested = urls && urls.length > 0 ? urls : defaultResearchUrls(domain);

    const cachedFailure = await this.cache.getFreshFailure(domain);
    if (cachedFailure) {
      throw new AppError(
        "PROVIDER_ERROR",
        "Website research recently failed for this domain; not scraping again. Call save_lead with needs_review.",
        false,
      );
    }

    const [cachedRows, recorded] = await Promise.all([
      this.cache.listFreshForDomain(domain),
      this.sources.listForCompany(companyId),
    ]);

    const byNormalized = new Map<string, ResearchedSource>();
    for (const row of cachedRows) {
      byNormalized.set(row.normalized_url, cacheRowToSource(row));
    }
    for (const row of recorded) {
      byNormalized.set(row.normalized_url, sourceRowToResearched(row));
    }

    const missing = requested.filter(
      (url) => !byNormalized.has(normalizeUrl(url)),
    );

    if (missing.length > 0) {
      const scraped = await this.scrapeWithRetry(domain, missing);
      try {
        await this.cache.upsertPages(domain, scraped, "firecrawl");
      } catch {
        // Cache write must not fail a successful scrape.
      }
      for (const source of scraped) {
        byNormalized.set(normalizeUrl(source.url), source);
      }
    }

    const combined = requested
      .map((url) => byNormalized.get(normalizeUrl(url)))
      .filter((source): source is ResearchedSource => Boolean(source));

    if (combined.length === 0) {
      await this.cache.recordFailure(
        domain,
        "Website research did not return any usable content for this company.",
      );
      throw new AppError(
        "PROVIDER_ERROR",
        "Website research did not return any usable content for this company.",
        false,
      );
    }

    return combined;
  }

  private async scrapeWithRetry(
    domain: string,
    urls: string[],
  ): Promise<ResearchedSource[]> {
    try {
      const first = await this.provider.research({ domain, urls });
      return first.sources;
    } catch (err) {
      if (!isRetryableProviderMiss(err)) throw err;
    }

    try {
      const second = await this.provider.research({ domain, urls });
      return second.sources;
    } catch (err) {
      const message = isAppError(err)
        ? err.message
        : "Website research did not return any usable content for this company.";
      await this.cache.recordFailure(domain, message);
      throw new AppError("PROVIDER_ERROR", message, false);
    }
  }

  /** `run` must already be authorization-checked by the caller. */
  async recordSource(
    run: RunRow,
    input: {
      companyId: string;
      url: string;
      title?: string;
      sourceType: LeadSourceRow["source_type"];
      summary: string;
      relevantExcerpt?: string;
      provider?: string;
    },
  ): Promise<LeadSourceRow> {
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

function sourceRowToResearched(row: LeadSourceRow): ResearchedSource {
  return {
    url: row.url,
    title: row.title ?? undefined,
    sourceType: row.source_type,
    summary: row.summary,
    relevantExcerpt: row.relevant_excerpt ?? undefined,
  };
}

function isRetryableProviderMiss(err: unknown): boolean {
  return isAppError(err) && err.code === "PROVIDER_ERROR";
}
