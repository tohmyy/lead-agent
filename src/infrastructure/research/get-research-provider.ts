import "server-only";

import { getServerEnv } from "@/lib/config/env";
import { FirecrawlResearchProvider } from "./firecrawl-research-provider";
import type { WebsiteResearchProvider } from "./research-provider";

/**
 * Selects the active research provider without the caller (DiscoveryService/
 * ResearchService/tools) ever knowing which one is active — ARCHITECTURE2.md
 * section 65 / AGENTS.md #19. Crawl4AI is deferred to a follow-up pass per
 * the implementation plan's scope note.
 */
export function getResearchProvider(): WebsiteResearchProvider {
  const env = getServerEnv();
  switch (env.RESEARCH_PROVIDER) {
    case "firecrawl":
      return new FirecrawlResearchProvider();
    case "crawl4ai":
      throw new Error(
        "RESEARCH_PROVIDER=crawl4ai is not implemented in this build. Use firecrawl, or implement Crawl4AIResearchProvider against the WebsiteResearchProvider interface.",
      );
  }
}
