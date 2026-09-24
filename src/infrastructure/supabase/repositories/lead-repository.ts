import "server-only";

import { AppError } from "@/domain/shared/errors";
import type { SaveLeadInput } from "@/domain/leads/lead";
import { createServiceRoleSupabaseClient } from "@/infrastructure/supabase/service-role-client";
import type { LeadRow } from "@/infrastructure/supabase/types";

export class LeadRepository {
  private get db() {
    return createServiceRoleSupabaseClient();
  }

  /**
   * Upserts on (run_id, discovered_company_id) — a discovered company has
   * at most one qualification record per run (data-model.md section 40).
   */
  async upsert(input: {
    runId: string;
    companyId: string;
    companyName: string;
    domain: string;
    data: SaveLeadInput;
  }): Promise<{ lead: LeadRow; wasNew: boolean }> {
    const { data: existing } = await this.db
      .from("leads")
      .select("id")
      .eq("run_id", input.runId)
      .eq("discovered_company_id", input.companyId)
      .maybeSingle();

    const payload = {
      run_id: input.runId,
      discovered_company_id: input.companyId,
      company_name: input.companyName,
      domain: input.domain,
      qualification_status: input.data.qualification_status,
      confidence_score: input.data.confidence_score ?? null,
      fit_reasons: input.data.fit_reasons,
      concerns: input.data.concerns,
      qualification_reasoning: input.data.qualification_reasoning,
      source_summary: input.data.source_summary,
      research_metadata: input.data.research_metadata ?? null,
      qualified_at:
        input.data.qualification_status === "qualified"
          ? new Date().toISOString()
          : null,
    };

    if (existing) {
      const { data, error } = await this.db
        .from("leads")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw new AppError("DATABASE_ERROR", "Failed to update lead.");
      return { lead: data, wasNew: false };
    }

    const { data, error } = await this.db
      .from("leads")
      .insert(payload)
      .select()
      .single();
    if (error) throw new AppError("DATABASE_ERROR", "Failed to persist lead.");
    return { lead: data, wasNew: true };
  }

  async getOwned(leadId: string, runId: string): Promise<LeadRow> {
    const { data, error } = await this.db
      .from("leads")
      .select()
      .eq("id", leadId)
      .eq("run_id", runId)
      .maybeSingle();

    if (error) throw new AppError("DATABASE_ERROR", "Failed to load lead.");
    if (!data)
      throw new AppError("LEAD_NOT_FOUND", "Lead not found for this run.");
    return data;
  }

  async getByCompany(
    companyId: string,
    runId: string,
  ): Promise<LeadRow | null> {
    const { data, error } = await this.db
      .from("leads")
      .select()
      .eq("discovered_company_id", companyId)
      .eq("run_id", runId)
      .maybeSingle();

    if (error) throw new AppError("DATABASE_ERROR", "Failed to load lead.");
    return data;
  }

  async listForRun(runId: string): Promise<LeadRow[]> {
    const { data, error } = await this.db
      .from("leads")
      .select()
      .eq("run_id", runId)
      .order("created_at", { ascending: true });

    if (error) throw new AppError("DATABASE_ERROR", "Failed to list leads.");
    return data ?? [];
  }

  async updateReviewState(
    leadId: string,
    runId: string,
    reviewState: LeadRow["review_state"],
  ): Promise<LeadRow> {
    const { data, error } = await this.db
      .from("leads")
      .update({ review_state: reviewState })
      .eq("id", leadId)
      .eq("run_id", runId)
      .select()
      .maybeSingle();

    if (error)
      throw new AppError(
        "DATABASE_ERROR",
        "Failed to update lead review state.",
      );
    if (!data)
      throw new AppError("LEAD_NOT_FOUND", "Lead not found for this run.");
    return data;
  }
}
