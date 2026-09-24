import "server-only";

import { AppError } from "@/domain/shared/errors";
import type { IcpCriteriaInput } from "@/domain/icp/icp";
import { createServiceRoleSupabaseClient } from "@/infrastructure/supabase/service-role-client";
import type { RunIcpRow } from "@/infrastructure/supabase/types";

export class IcpRepository {
  private get db() {
    return createServiceRoleSupabaseClient();
  }

  async saveDraft(input: {
    runId: string;
    criteria: IcpCriteriaInput;
    reasoning: string;
    source: "agent" | "user";
  }): Promise<RunIcpRow> {
    const { data: latest } = await this.db
      .from("run_icps")
      .select("version")
      .eq("run_id", input.runId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (latest?.version ?? 0) + 1;

    const { data, error } = await this.db
      .from("run_icps")
      .insert({
        run_id: input.runId,
        version: nextVersion,
        source: input.source,
        criteria: input.criteria,
        reasoning: input.reasoning,
        approved: false,
      })
      .select()
      .single();

    if (error) throw new AppError("DATABASE_ERROR", "Failed to save ICP.");
    return data;
  }

  async getApproved(runId: string): Promise<RunIcpRow | null> {
    const { data, error } = await this.db
      .from("run_icps")
      .select()
      .eq("run_id", runId)
      .eq("approved", true)
      .maybeSingle();

    if (error)
      throw new AppError("DATABASE_ERROR", "Failed to load approved ICP.");
    return data;
  }

  async getLatest(runId: string): Promise<RunIcpRow | null> {
    const { data, error } = await this.db
      .from("run_icps")
      .select()
      .eq("run_id", runId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error)
      throw new AppError("DATABASE_ERROR", "Failed to load latest ICP.");
    return data;
  }

  async listVersions(runId: string): Promise<RunIcpRow[]> {
    const { data, error } = await this.db
      .from("run_icps")
      .select()
      .eq("run_id", runId)
      .order("version", { ascending: true });

    if (error)
      throw new AppError("DATABASE_ERROR", "Failed to list ICP versions.");
    return data ?? [];
  }

  /**
   * Approves a specific ICP version. This is the only path that can set
   * approved=true (TOOLS-CONTRACT.md section 9: "ICP approval is
   * intentionally not an agent tool") — callers must be the application's
   * own approval endpoint, invoked by a human action.
   */
  async approve(
    runId: string,
    icpId: string,
    approvedBy: string,
  ): Promise<RunIcpRow> {
    // Only one ICP revision may be "the" approved one per run
    // (data-model.md section 11) — clear any prior approval first so the
    // unique partial index (run_icps_one_approved_per_run) never conflicts.
    const { error: clearError } = await this.db
      .from("run_icps")
      .update({ approved: false })
      .eq("run_id", runId)
      .eq("approved", true);
    if (clearError) {
      throw new AppError(
        "DATABASE_ERROR",
        "Failed to clear prior ICP approval.",
      );
    }

    const { data, error } = await this.db
      .from("run_icps")
      .update({
        approved: true,
        approved_at: new Date().toISOString(),
        approved_by: approvedBy,
      })
      .eq("id", icpId)
      .eq("run_id", runId)
      .select()
      .maybeSingle();

    if (error) throw new AppError("DATABASE_ERROR", "Failed to approve ICP.");
    if (!data)
      throw new AppError(
        "RUN_NOT_FOUND",
        "ICP version not found for this run.",
      );
    return data;
  }
}
