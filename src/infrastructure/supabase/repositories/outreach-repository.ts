import "server-only";

import { AppError } from "@/domain/shared/errors";
import type { SaveOutreachDraftInput } from "@/domain/outreach/outreach";
import { createServiceRoleSupabaseClient } from "@/infrastructure/supabase/service-role-client";
import type { OutreachDraftRow } from "@/infrastructure/supabase/types";

export class OutreachRepository {
  private get db() {
    return createServiceRoleSupabaseClient();
  }

  /**
   * Outreach drafts are versioned, not overwritten (TOOLS-CONTRACT.md
   * section 44): a regenerate creates the next version for the same
   * (lead_id, channel, step) rather than mutating a reviewed draft.
   */
  async createDraft(input: {
    runId: string;
    data: SaveOutreachDraftInput;
  }): Promise<OutreachDraftRow> {
    let versionQuery = this.db
      .from("outreach_drafts")
      .select("version")
      .eq("lead_id", input.data.lead_id)
      .eq("channel", input.data.channel);
    versionQuery =
      input.data.channel === "email"
        ? versionQuery.eq("step", input.data.step)
        : versionQuery.is("step", null);

    const { data: latest } = await versionQuery
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (latest?.version ?? 0) + 1;

    const { data, error } = await this.db
      .from("outreach_drafts")
      .insert({
        lead_id: input.data.lead_id,
        run_id: input.runId,
        channel: input.data.channel,
        step: input.data.channel === "email" ? input.data.step : null,
        subject: input.data.channel === "email" ? input.data.subject : null,
        body: input.data.body,
        personalization_context: input.data.personalization_context,
        version: nextVersion,
      })
      .select()
      .single();

    if (error)
      throw new AppError("DATABASE_ERROR", "Failed to persist outreach draft.");
    return data;
  }

  async listForLead(leadId: string): Promise<OutreachDraftRow[]> {
    const { data, error } = await this.db
      .from("outreach_drafts")
      .select()
      .eq("lead_id", leadId)
      .order("channel", { ascending: true })
      .order("step", { ascending: true })
      .order("version", { ascending: false });

    if (error)
      throw new AppError("DATABASE_ERROR", "Failed to list outreach drafts.");
    return data ?? [];
  }

  async listForRun(runId: string): Promise<OutreachDraftRow[]> {
    const { data, error } = await this.db
      .from("outreach_drafts")
      .select()
      .eq("run_id", runId);

    if (error)
      throw new AppError("DATABASE_ERROR", "Failed to list outreach drafts.");
    return data ?? [];
  }

  async updateContent(
    draftId: string,
    runId: string,
    updates: { subject?: string; body?: string },
  ): Promise<OutreachDraftRow> {
    const { data, error } = await this.db
      .from("outreach_drafts")
      .update({ ...updates, review_state: "edited" })
      .eq("id", draftId)
      .eq("run_id", runId)
      .select()
      .maybeSingle();

    if (error)
      throw new AppError("DATABASE_ERROR", "Failed to update outreach draft.");
    if (!data)
      throw new AppError(
        "LEAD_NOT_FOUND",
        "Outreach draft not found for this run.",
      );
    return data;
  }

  async updateReviewState(
    draftId: string,
    runId: string,
    reviewState: OutreachDraftRow["review_state"],
  ): Promise<OutreachDraftRow> {
    const { data, error } = await this.db
      .from("outreach_drafts")
      .update({ review_state: reviewState })
      .eq("id", draftId)
      .eq("run_id", runId)
      .select()
      .maybeSingle();

    if (error)
      throw new AppError("DATABASE_ERROR", "Failed to update review state.");
    if (!data)
      throw new AppError(
        "LEAD_NOT_FOUND",
        "Outreach draft not found for this run.",
      );
    return data;
  }
}
