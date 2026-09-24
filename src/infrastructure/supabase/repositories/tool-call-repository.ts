import "server-only";

import { createServiceRoleSupabaseClient } from "@/infrastructure/supabase/service-role-client";
import type { ToolCallRow } from "@/infrastructure/supabase/types";

/**
 * Tool-call logging is automatic (TOOLS-CONTRACT.md section 38, the "later
 * track" resolution in the implementation plan) — the agent can neither
 * skip nor fake it, because the wrapper in agents/tools/tool-runner.ts
 * calls this repository around every tool execution, not the agent itself.
 * Failures here are swallowed by the caller (best-effort audit logging
 * must never take down a tool call that otherwise succeeded).
 */
export class ToolCallRepository {
  private get db() {
    return createServiceRoleSupabaseClient();
  }

  async start(input: {
    runId: string;
    toolName: string;
    purpose: string;
    inputSummary: Record<string, unknown>;
  }): Promise<string | null> {
    const { data, error } = await this.db
      .from("tool_calls")
      .insert({
        run_id: input.runId,
        tool_name: input.toolName,
        purpose: input.purpose,
        input_summary: input.inputSummary,
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) return null;
    return data.id;
  }

  async complete(
    id: string,
    outcome: {
      status: "success" | "failed";
      resultSummary?: Record<string, unknown>;
      errorMessage?: string;
      externalReference?: string;
      startedAtMs: number;
    },
  ): Promise<void> {
    const completedAt = new Date();
    await this.db
      .from("tool_calls")
      .update({
        status: outcome.status,
        result_summary: outcome.resultSummary,
        error_message: outcome.errorMessage,
        external_reference: outcome.externalReference,
        completed_at: completedAt.toISOString(),
        duration_ms: Date.now() - outcome.startedAtMs,
      })
      .eq("id", id);
  }

  async listForRun(runId: string): Promise<ToolCallRow[]> {
    const { data } = await this.db
      .from("tool_calls")
      .select()
      .eq("run_id", runId)
      .order("started_at", { ascending: true });
    return data ?? [];
  }
}
