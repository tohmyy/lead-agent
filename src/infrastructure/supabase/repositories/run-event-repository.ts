import "server-only";

import { AppError } from "@/domain/shared/errors";
import { createServiceRoleSupabaseClient } from "@/infrastructure/supabase/service-role-client";
import type {
  RunEventRow,
  RunEventType,
} from "@/infrastructure/supabase/types";
import { sanitizeForLog } from "@/lib/logging/sanitize";

export class RunEventRepository {
  private get db() {
    return createServiceRoleSupabaseClient();
  }

  async record(input: {
    runId: string;
    eventType: RunEventType;
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<RunEventRow> {
    const { data, error } = await this.db
      .from("run_events")
      .insert({
        run_id: input.runId,
        event_type: input.eventType,
        message: input.message,
        metadata: input.metadata
          ? (sanitizeForLog(input.metadata) as Record<string, unknown>)
          : input.metadata,
      })
      .select()
      .single();

    if (error)
      throw new AppError("DATABASE_ERROR", "Failed to record run event.");
    return data;
  }

  async listForRun(runId: string): Promise<RunEventRow[]> {
    const { data, error } = await this.db
      .from("run_events")
      .select()
      .eq("run_id", runId)
      .order("created_at", { ascending: true });

    if (error)
      throw new AppError("DATABASE_ERROR", "Failed to list run events.");
    return data ?? [];
  }
}
