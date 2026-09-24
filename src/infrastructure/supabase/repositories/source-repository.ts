import "server-only";

import { AppError } from "@/domain/shared/errors";
import { normalizeUrl } from "@/domain/shared/normalize";
import { createServiceRoleSupabaseClient } from "@/infrastructure/supabase/service-role-client";
import type {
  LeadSourceRow,
  SourceType,
} from "@/infrastructure/supabase/types";

export class SourceRepository {
  private get db() {
    return createServiceRoleSupabaseClient();
  }

  /**
   * Upserts on (discovered_company_id, normalized_url) — avoids duplicate
   * source records for the same page (TOOLS-CONTRACT.md section 43).
   */
  async recordSource(input: {
    runId: string;
    companyId: string;
    url: string;
    title?: string;
    sourceType: SourceType;
    summary: string;
    relevantExcerpt?: string;
    provider: string;
    metadata?: Record<string, unknown>;
  }): Promise<LeadSourceRow> {
    const normalizedUrl = normalizeUrl(input.url);

    const { data: existing } = await this.db
      .from("lead_sources")
      .select()
      .eq("discovered_company_id", input.companyId)
      .eq("normalized_url", normalizedUrl)
      .maybeSingle();

    if (existing) {
      const { data, error } = await this.db
        .from("lead_sources")
        .update({
          title: input.title,
          summary: input.summary,
          relevant_excerpt: input.relevantExcerpt,
          scraped_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (error)
        throw new AppError("DATABASE_ERROR", "Failed to update source.");
      return data;
    }

    const { data, error } = await this.db
      .from("lead_sources")
      .insert({
        discovered_company_id: input.companyId,
        run_id: input.runId,
        url: input.url,
        normalized_url: normalizedUrl,
        title: input.title,
        source_type: input.sourceType,
        summary: input.summary,
        relevant_excerpt: input.relevantExcerpt,
        provider: input.provider,
        metadata: input.metadata,
      })
      .select()
      .single();

    if (error)
      throw new AppError("DATABASE_ERROR", "Failed to persist source.");
    return data;
  }

  async listForCompany(companyId: string): Promise<LeadSourceRow[]> {
    const { data, error } = await this.db
      .from("lead_sources")
      .select()
      .eq("discovered_company_id", companyId)
      .order("scraped_at", { ascending: true });

    if (error) throw new AppError("DATABASE_ERROR", "Failed to list sources.");
    return data ?? [];
  }
}
