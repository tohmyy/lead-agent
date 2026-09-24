import "server-only";

import { AppError } from "@/domain/shared/errors";
import { normalizeCompanyName, normalizeDomain } from "@/domain/shared/normalize";
import { createServiceRoleSupabaseClient } from "@/infrastructure/supabase/service-role-client";
import type { DiscoveredCompanyRow } from "@/infrastructure/supabase/types";

export class CompanyRepository {
  private get db() {
    return createServiceRoleSupabaseClient();
  }

  /**
   * Upserts on (run_id, normalized_domain) so the same company discovered
   * twice in one run never creates two records (data-model.md section 14 /
   * TOOLS-CONTRACT.md section 42).
   */
  async upsertDiscovered(input: {
    runId: string;
    companyName: string;
    domain: string;
    discoverySource: string;
    sourceUrl?: string;
    externalId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ company: DiscoveredCompanyRow; wasNew: boolean }> {
    const normalizedDomain = normalizeDomain(input.domain);

    const { data: existing, error: findError } = await this.db
      .from("discovered_companies")
      .select()
      .eq("run_id", input.runId)
      .eq("normalized_domain", normalizedDomain)
      .maybeSingle();

    if (findError) {
      throw new AppError(
        "DATABASE_ERROR",
        "Failed to look up discovered company.",
      );
    }
    if (existing) return { company: existing, wasNew: false };

    const { data, error } = await this.db
      .from("discovered_companies")
      .insert({
        run_id: input.runId,
        company_name: normalizeCompanyName(input.companyName),
        domain: input.domain,
        normalized_domain: normalizedDomain,
        discovery_source: input.discoverySource,
        source_url: input.sourceUrl,
        external_id: input.externalId,
        raw_metadata: input.metadata,
      })
      .select()
      .single();

    if (error) {
      // Concurrent insert raced us — re-fetch instead of erroring.
      const { data: raced } = await this.db
        .from("discovered_companies")
        .select()
        .eq("run_id", input.runId)
        .eq("normalized_domain", normalizedDomain)
        .maybeSingle();
      if (raced) return { company: raced, wasNew: false };
      throw new AppError(
        "DATABASE_ERROR",
        "Failed to persist discovered company.",
      );
    }

    return { company: data, wasNew: true };
  }

  async getOwned(
    companyId: string,
    runId: string,
  ): Promise<DiscoveredCompanyRow> {
    const { data, error } = await this.db
      .from("discovered_companies")
      .select()
      .eq("id", companyId)
      .eq("run_id", runId)
      .maybeSingle();

    if (error) throw new AppError("DATABASE_ERROR", "Failed to load company.");
    if (!data)
      throw new AppError(
        "COMPANY_NOT_FOUND",
        "Company not found for this run.",
      );
    return data;
  }

  async listForRun(runId: string): Promise<DiscoveredCompanyRow[]> {
    const { data, error } = await this.db
      .from("discovered_companies")
      .select()
      .eq("run_id", runId)
      .order("discovered_at", { ascending: true });

    if (error)
      throw new AppError("DATABASE_ERROR", "Failed to list companies.");
    return data ?? [];
  }
}
