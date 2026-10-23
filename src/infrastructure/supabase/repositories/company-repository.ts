import "server-only";

import { AppError } from "@/domain/shared/errors";
import {
  resolveIncomingIdentity,
  selectExistingCompany,
  shouldUpgradeUnresolvedDomain,
} from "@/domain/companies/identity";
import { createServiceRoleSupabaseClient } from "@/infrastructure/supabase/service-role-client";
import type { DiscoveredCompanyRow } from "@/infrastructure/supabase/types";

export class CompanyRepository {
  private get db() {
    return createServiceRoleSupabaseClient();
  }

  /**
   * Upserts so the same company discovered twice in one run never creates
   * two records. Identity is (run_id, normalized_domain) plus in-run
   * collapse on external_id and normalized name — LinkedIn profile URLs
   * must not become a second "company" next to the real website.
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
    const identity = resolveIncomingIdentity({
      companyName: input.companyName,
      domain: input.domain,
      sourceUrl: input.sourceUrl,
      externalId: input.externalId,
    });

    const existingRows = await this.listForRun(input.runId);
    const existing = selectExistingCompany(existingRows, identity);
    if (existing) {
      if (shouldUpgradeUnresolvedDomain(existing.normalized_domain, identity)) {
        return {
          company: await this.upgradeDomain(existing.id, {
            domain: identity.domain,
            normalizedDomain: identity.normalizedDomain,
            sourceUrl: identity.sourceUrl,
            externalId: identity.externalId,
            metadata: input.metadata,
          }),
          wasNew: false,
        };
      }
      return { company: existing, wasNew: false };
    }

    const { data, error } = await this.db
      .from("discovered_companies")
      .insert({
        run_id: input.runId,
        company_name: identity.displayName,
        domain: identity.domain,
        normalized_domain: identity.normalizedDomain,
        normalized_name: identity.nameKey,
        discovery_source: input.discoverySource,
        source_url: identity.sourceUrl,
        external_id: identity.externalId,
        raw_metadata: input.metadata,
      })
      .select()
      .single();

    if (error) {
      const raced = await this.refetchDuplicate(input.runId, identity);
      if (raced) return { company: raced, wasNew: false };
      throw new AppError(
        "DATABASE_ERROR",
        "Failed to persist discovered company.",
      );
    }

    return { company: data, wasNew: true };
  }

  private async upgradeDomain(
    id: string,
    patch: {
      domain: string;
      normalizedDomain: string;
      sourceUrl?: string;
      externalId?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<DiscoveredCompanyRow> {
    const { data, error } = await this.db
      .from("discovered_companies")
      .update({
        domain: patch.domain,
        normalized_domain: patch.normalizedDomain,
        source_url: patch.sourceUrl,
        external_id: patch.externalId ?? undefined,
        raw_metadata: patch.metadata,
      })
      .eq("id", id)
      .select()
      .single();
    if (error || !data) {
      throw new AppError(
        "DATABASE_ERROR",
        "Failed to update discovered company domain.",
      );
    }
    return data;
  }

  private async refetchDuplicate(
    runId: string,
    identity: ReturnType<typeof resolveIncomingIdentity>,
  ): Promise<DiscoveredCompanyRow | undefined> {
    const rows = await this.listForRun(runId);
    return selectExistingCompany(rows, identity);
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
