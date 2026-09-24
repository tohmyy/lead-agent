import "server-only";

import FirecrawlApp from "@mendable/firecrawl-js";

import { AppError } from "@/domain/shared/errors";
import { getServerEnv } from "@/lib/config/env";
import { assertUrlIsSafeToFetch } from "@/lib/security/url-safety";
import type { SourceType } from "@/infrastructure/supabase/types";
import {
  RELEVANT_PAGE_PATHS,
  type ResearchRequest,
  type ResearchResult,
  type ResearchedSource,
  type WebsiteResearchProvider,
} from "./research-provider";

/** Bounded research: never fetch more than this many pages in one tool call (TOOLS-CONTRACT.md section 23). */
const MAX_PAGES_PER_CALL = 5;
const SCRAPE_TIMEOUT_MS = 20_000;
const SUMMARY_MAX_CHARS = 500;
const EXCERPT_MAX_CHARS = 1200;

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

function classifyPage(url: URL): SourceType {
  const pathname = url.pathname.toLowerCase().replace(/^\/|\/$/g, "");
  if (pathname === "") return "homepage";
  for (const [type, paths] of Object.entries(RELEVANT_PAGE_PATHS)) {
    if (paths.some((p) => p !== "" && pathname.startsWith(p))) {
      return type as SourceType;
    }
  }
  return "other";
}

export class FirecrawlResearchProvider implements WebsiteResearchProvider {
  private _client: FirecrawlApp | undefined;

  /**
   * Deliberately lazy — see the matching comment on ApifyDiscoveryProvider:
   * reading env vars at construction time breaks Next.js's build-time
   * route analysis for pages that merely import a module which
   * default-constructs this class, long before any request exists.
   */
  private get client(): FirecrawlApp {
    if (!this._client) {
      const env = getServerEnv();
      this._client = new FirecrawlApp({ apiKey: env.FIRECRAWL_API_KEY });
    }
    return this._client;
  }

  async research(request: ResearchRequest): Promise<ResearchResult> {
    const candidates =
      request.urls && request.urls.length > 0
        ? request.urls
        : [`https://${request.domain}`];

    const bounded = candidates.slice(0, MAX_PAGES_PER_CALL);
    const sources: ResearchedSource[] = [];

    for (const rawUrl of bounded) {
      // Throws SSRF_BLOCKED/INVALID_URL — intentionally not caught, since an
      // unsafe URL should fail the whole call rather than be silently skipped.
      const safeUrl = await assertUrlIsSafeToFetch(rawUrl);

      let response;
      try {
        response = await this.client.scrapeUrl(safeUrl.toString(), {
          formats: ["markdown"],
          onlyMainContent: true,
          timeout: SCRAPE_TIMEOUT_MS,
          blockAds: true,
        });
      } catch {
        // One page failing shouldn't fail the whole research call
        // (ARCHITECTURE2.md section 36: failure isolation) — skip it.
        continue;
      }

      if (!response.success) continue;

      const markdown = response.markdown ?? "";
      const description =
        response.metadata?.description ?? response.description ?? "";
      const summarySource = description || markdown;
      if (!summarySource.trim()) continue;

      sources.push({
        url: safeUrl.toString(),
        title: response.metadata?.title ?? response.title,
        sourceType: classifyPage(safeUrl),
        summary: truncate(summarySource, SUMMARY_MAX_CHARS),
        relevantExcerpt: markdown
          ? truncate(markdown, EXCERPT_MAX_CHARS)
          : undefined,
      });
    }

    if (sources.length === 0) {
      throw new AppError(
        "PROVIDER_ERROR",
        "Website research did not return any usable content for this company.",
        true,
      );
    }

    return { sources };
  }
}
