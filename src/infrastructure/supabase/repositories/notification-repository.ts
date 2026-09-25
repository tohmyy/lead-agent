import "server-only";

import { AppError } from "@/domain/shared/errors";
import { createServiceRoleSupabaseClient } from "@/infrastructure/supabase/service-role-client";
import type { NotificationRow, NotificationType } from "@/infrastructure/supabase/types";

export class NotificationRepository {
  private get db() {
    return createServiceRoleSupabaseClient();
  }

  async create(input: {
    userId: string;
    runId: string | null;
    type: NotificationType;
    title: string;
    message: string;
  }): Promise<NotificationRow> {
    const { data, error } = await this.db
      .from("notifications")
      .insert({
        user_id: input.userId,
        run_id: input.runId,
        type: input.type,
        title: input.title,
        message: input.message,
      })
      .select()
      .single();

    if (error)
      throw new AppError("DATABASE_ERROR", "Failed to record notification.");
    return data;
  }

  async listForUser(
    userId: string,
    opts?: { limit?: number },
  ): Promise<NotificationRow[]> {
    const { data, error } = await this.db
      .from("notifications")
      .select()
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(opts?.limit ?? 20);

    if (error)
      throw new AppError("DATABASE_ERROR", "Failed to list notifications.");
    return data ?? [];
  }

  /**
   * A zero-row match (already read, or an id the caller doesn't own) is a
   * silent no-op rather than a thrown error — the id can only ever reach
   * here via that same user's own listForUser() result, so this isn't a
   * security boundary, just idempotent bookkeeping.
   */
  async markRead(id: string, userId: string): Promise<void> {
    const { error } = await this.db
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);

    if (error)
      throw new AppError("DATABASE_ERROR", "Failed to mark notification read.");
  }

  async markAllRead(userId: string): Promise<void> {
    const { error } = await this.db
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);

    if (error)
      throw new AppError(
        "DATABASE_ERROR",
        "Failed to mark notifications read.",
      );
  }
}
