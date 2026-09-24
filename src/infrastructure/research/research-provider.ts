import type { SourceType } from "@/infrastructure/supabase/types";

export interface ResearchRequest {
  domain: string;
  /** Explicit URLs to research; when omitted the provider should discover relevant pages itself. */
  urls?: string[];
}

export interface ResearchedSource {
  url: string;
  title?: string;
  sourceType: SourceType;
  summary: string;
  relevantExcerpt?: string;
}

export interface ResearchResult {
  sources: ResearchedSource[];
}

/**
 * Website research provider abstraction (ARCHITECTURE.md section 21 /
 * TOOLS-CONTRACT.md section 57). The rest of the application never knows
 * whether Firecrawl or Crawl4AI is active.
 */
export interface WebsiteResearchProvider {
  research(request: ResearchRequest): Promise<ResearchResult>;
}

/** Pages worth researching for qualification (TOOLS-CONTRACT.md section 23) — bounded, not unlimited crawling. */
export const RELEVANT_PAGE_PATHS: Record<
  Exclude<SourceType, "other">,
  string[]
> = {
  homepage: [""],
  about: ["about", "about-us", "company"],
  product: ["product", "products", "platform"],
  services: ["services"],
  pricing: ["pricing", "plans"],
  careers: ["careers", "jobs"],
  blog: ["blog", "news"],
};
