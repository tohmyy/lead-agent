import "server-only";

import { AppError } from "@/domain/shared/errors";
import { normalizeDomain, normalizeUrl } from "@/domain/shared/normalize";
import { createServiceRoleSupabaseClient } from "@/infrastructure/supabase/service-role-client";
import type {
  SourceType,
  WebsiteResearchCacheRow,
  WebsiteResearchFailureRow,
} from "@/infrastructure/supabase/types";
import type { ResearchedSource } from "@/infrastructure/research/research-provider";

export const RESEARCH_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const RESEARCH_FAILURE_TTL_MS = 24 * 60 * 60 * 1000;

export class ResearchCacheRepository {
  private get db() {
    return createServiceRoleSupabaseClient();
  }

  async listFreshForDomain(
    domain: string,
    now = Date.now(),
  ): Promise<WebsiteResearchCacheRow[]> {
    const normalizedDomain = normalizeDomain(domain);
    const cutoff = new Date(now - RESEARCH_CACHE_TTL_MS).toISOString();
    const { data, error } = await this.db
      .from("website_research_cache")
      .select()
      .eq("normalized_domain", normalizedDomain)
      .gte("fetched_at", cutoff);

    if (error)
      throw new AppError("DATABASE_ERROR", "Failed to load research cache.");
    return data ?? [];
  }

  async upsertPages(
    domain: string,
    sources: ResearchedSource[],
    provider: string,
  ): Promise<void> {
    const normalizedDomain = normalizeDomain(domain);
    for (const source of sources) {
      const normalizedUrl = normalizeUrl(source.url);
      const { data: existing, error: findError } = await this.db
        .from("website_research_cache")
        .select("id")
        .eq("normalized_domain", normalizedDomain)
        .eq("normalized_url", normalizedUrl)
        .maybeSingle();
      if (findError)
        throw new AppError("DATABASE_ERROR", "Failed to look up research cache.");

      const payload = {
        normalized_domain: normalizedDomain,
        normalized_url: normalizedUrl,
        title: source.title,
        source_type: source.sourceType,
        summary: source.summary,
        relevant_excerpt: source.relevantExcerpt,
        provider,
        fetched_at: new Date().toISOString(),
      };

      if (existing) {
        const { error } = await this.db
          .from("website_research_cache")
          .update(payload)
          .eq("id", existing.id);
        if (error)
          throw new AppError("DATABASE_ERROR", "Failed to update research cache.");
      } else {
        const { error } = await this.db
          .from("website_research_cache")
          .insert(payload);
        if (error)
          throw new AppError("DATABASE_ERROR", "Failed to persist research cache.");
      }
    }
  }

  async getFreshFailure(
    domain: string,
    now = Date.now(),
  ): Promise<WebsiteResearchFailureRow | null> {
    const normalizedDomain = normalizeDomain(domain);
    const { data, error } = await this.db
      .from("website_research_failures")
      .select()
      .eq("normalized_domain", normalizedDomain)
      .maybeSingle();
    if (error)
      throw new AppError("DATABASE_ERROR", "Failed to load research failure cache.");
    if (!data) return null;
    if (now - new Date(data.failed_at).getTime() > RESEARCH_FAILURE_TTL_MS) {
      return null;
    }
    return data;
  }

  async recordFailure(domain: string, errorMessage: string): Promise<void> {
    const normalizedDomain = normalizeDomain(domain);
    const { data: existing } = await this.db
      .from("website_research_failures")
      .select("normalized_domain")
      .eq("normalized_domain", normalizedDomain)
      .maybeSingle();

    const payload = {
      normalized_domain: normalizedDomain,
      error_message: errorMessage,
      failed_at: new Date().toISOString(),
    };

    if (existing) {
      await this.db
        .from("website_research_failures")
        .update(payload)
        .eq("normalized_domain", normalizedDomain);
      return;
    }
    await this.db.from("website_research_failures").insert(payload);
  }
}

export function cacheRowToSource(row: WebsiteResearchCacheRow): ResearchedSource {
  return {
    url: `https://${row.normalized_url}`,
    title: row.title ?? undefined,
    sourceType: row.source_type as SourceType,
    summary: row.summary,
    relevantExcerpt: row.relevant_excerpt ?? undefined,
  };
}
