"use server";

import { revalidatePath } from "next/cache";

import { RunRepository } from "@/infrastructure/supabase/repositories/run-repository";
import { LeadRepository } from "@/infrastructure/supabase/repositories/lead-repository";
import { OutreachRepository } from "@/infrastructure/supabase/repositories/outreach-repository";
import type { ReviewState } from "@/infrastructure/supabase/types";
import { requireCurrentUserId } from "@/lib/auth/current-user";

const runs = new RunRepository();
const leads = new LeadRepository();
const outreach = new OutreachRepository();

/**
 * Every action here re-verifies run ownership before writing (AGENTS.md
 * #25) — these are human-review actions, not agent tools, but they use the
 * same repositories that bypass RLS, so the ownership check has to happen
 * here explicitly.
 */
async function assertOwnsRun(runId: string): Promise<string> {
  const userId = await requireCurrentUserId();
  await runs.getOwnedRun(runId, userId);
  return userId;
}

export async function setLeadReviewState(
  runId: string,
  leadId: string,
  reviewState: ReviewState,
): Promise<void> {
  await assertOwnsRun(runId);
  await leads.updateReviewState(leadId, runId, reviewState);
  revalidatePath(`/runs/${runId}`);
}

export async function saveLeadNote(
  runId: string,
  leadId: string,
  note: string,
): Promise<void> {
  await assertOwnsRun(runId);
  await leads.updateOperatorNote(
    leadId,
    runId,
    note.trim() === "" ? null : note,
  );
  revalidatePath(`/runs/${runId}`);
}

export async function updateOutreachDraft(
  runId: string,
  draftId: string,
  updates: { subject?: string; body: string },
): Promise<void> {
  await assertOwnsRun(runId);
  await outreach.updateContent(draftId, runId, updates);
  revalidatePath(`/runs/${runId}`);
}

export async function setOutreachReviewState(
  runId: string,
  draftId: string,
  reviewState: ReviewState,
): Promise<void> {
  await assertOwnsRun(runId);
  await outreach.updateReviewState(draftId, runId, reviewState);
  revalidatePath(`/runs/${runId}`);
}
