import "server-only";

import { AppError } from "@/domain/shared/errors";
import { assertValidTransition } from "@/domain/runs/run";
import { assertNonNegativeCostDelta } from "@/domain/runs/spend";
import { createServiceRoleSupabaseClient } from "@/infrastructure/supabase/service-role-client";
import type { RunRow, RunStatus } from "@/infrastructure/supabase/types";

/**
 * All privileged run access goes through this repository so ownership
 * checks live in exactly one place (AGENTS.md #25: "Do not depend on the
 * AI agent to maintain database invariants").
 */
export class RunRepository {
  private get db() {
    return createServiceRoleSupabaseClient();
  }

  async create(input: {
    userId: string;
    objective: string;
    qualifiedTarget: number;
    discoveryLimit: number;
  }): Promise<RunRow> {
    const { data, error } = await this.db
      .from("runs")
      .insert({
        user_id: input.userId,
        objective: input.objective,
        status: "draft",
        qualified_target: input.qualifiedTarget,
        discovery_limit: input.discoveryLimit,
        discovered_count: 0,
        qualified_count: 0,
        rejected_count: 0,
      })
      .select()
      .single();

    if (error) {
      throw new AppError("DATABASE_ERROR", "Failed to create run.");
    }
    return data;
  }

  /** Fetches a run and verifies the caller owns it. Throws otherwise. */
  async getOwnedRun(runId: string, userId: string): Promise<RunRow> {
    const { data, error } = await this.db
      .from("runs")
      .select()
      .eq("id", runId)
      .maybeSingle();

    if (error) throw new AppError("DATABASE_ERROR", "Failed to load run.");
    if (!data) throw new AppError("RUN_NOT_FOUND", "Run not found.");
    if (data.user_id !== userId) {
      throw new AppError("UNAUTHORIZED", "You do not have access to this run.");
    }
    return data;
  }

  async listForUser(userId: string): Promise<RunRow[]> {
    const { data, error } = await this.db
      .from("runs")
      .select()
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new AppError("DATABASE_ERROR", "Failed to list runs.");
    return data ?? [];
  }

  async transitionStatus(
    runId: string,
    from: RunStatus,
    to: RunStatus,
    extra?: Partial<
      Pick<RunRow, "started_at" | "completed_at" | "error_message">
    >,
  ): Promise<RunRow> {
    assertValidTransition(from, to);

    const { data, error } = await this.db
      .from("runs")
      .update({ status: to, ...extra })
      .eq("id", runId)
      .eq("status", from) // optimistic guard against concurrent transitions
      .select()
      .maybeSingle();

    if (error)
      throw new AppError("DATABASE_ERROR", "Failed to update run status.");
    if (!data) {
      throw new AppError(
        "RUN_NOT_ACTIVE",
        `Run is not in the expected "${from}" state (it may have already been transitioned concurrently).`,
      );
    }
    return data;
  }

  /**
   * Atomically reserves up to `count` discovery slots, incrementing
   * discovered_count only as far as discovery_limit allows. Returns the
   * number of slots actually reserved. Implemented as a conditional update
   * (not read-then-write) so two concurrent discovery calls cannot jointly
   * exceed the limit — TEST-PLAN.md LIMIT-005.
   */
  async reserveDiscoverySlots(runId: string, count: number): Promise<number> {
    const { data, error } = await this.db.rpc("reserve_discovery_slots", {
      p_run_id: runId,
      p_count: count,
    });
    if (error) {
      throw new AppError(
        "DATABASE_ERROR",
        "Failed to reserve discovery slots.",
      );
    }
    return data as number;
  }

  async releaseDiscoverySlots(runId: string, count: number): Promise<void> {
    if (count <= 0) return;
    const { error } = await this.db.rpc("release_discovery_slots", {
      p_run_id: runId,
      p_count: count,
    });
    if (error) {
      throw new AppError(
        "DATABASE_ERROR",
        "Failed to release discovery slots.",
      );
    }
  }

  async addCost(
    runId: string,
    delta: { discoveryUsd: number; agentUsd: number },
  ): Promise<void> {
    assertNonNegativeCostDelta(delta.discoveryUsd);
    assertNonNegativeCostDelta(delta.agentUsd);
    if (delta.discoveryUsd === 0 && delta.agentUsd === 0) return;

    const { error } = await this.db.rpc("add_run_cost", {
      p_run_id: runId,
      p_discovery_usd: delta.discoveryUsd,
      p_agent_usd: delta.agentUsd,
    });
    if (error) {
      throw new AppError("DATABASE_ERROR", "Failed to record run cost.");
    }
  }

  async incrementCounts(
    runId: string,
    delta: Partial<{ qualified_count: number; rejected_count: number }>,
  ): Promise<void> {
    const { error } = await this.db.rpc("increment_run_counts", {
      p_run_id: runId,
      p_qualified_delta: delta.qualified_count ?? 0,
      p_rejected_delta: delta.rejected_count ?? 0,
    });
    if (error) {
      throw new AppError("DATABASE_ERROR", "Failed to update run counters.");
    }
  }
}
