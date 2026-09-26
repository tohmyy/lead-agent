import { z } from "zod";

import { AppError } from "@/domain/shared/errors";
import type { OutreachDraftRow } from "@/infrastructure/supabase/types";

const personalizationClaimSchema = z.object({
  text: z.string().min(1),
  source_id: z.string().uuid(),
});

export const personalizationContextSchema = z.object({
  claims: z.array(personalizationClaimSchema),
});

const baseOutreachSchema = z.object({
  lead_id: z.string().uuid(),
  body: z.string().min(1).max(4000),
  personalization_context: personalizationContextSchema,
});

/**
 * save_outreach_draft input (TOOLS-CONTRACT.md sections 31-32, structured
 * personalization_context per the plan's conflict resolution). Discriminated
 * on channel so email requires subject/step and LinkedIn forbids them —
 * mirrors the DB CHECK constraint in 001_initial_schema.sql.
 */
export const saveOutreachDraftInputSchema = z.discriminatedUnion("channel", [
  baseOutreachSchema.extend({
    channel: z.literal("email"),
    step: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    subject: z.string().min(1).max(200),
  }),
  baseOutreachSchema.extend({
    channel: z.literal("linkedin"),
    step: z.undefined().optional(),
    subject: z.undefined().optional(),
  }),
]);

export type SaveOutreachDraftInput = z.infer<
  typeof saveOutreachDraftInputSchema
>;

/**
 * Every personalization claim must trace to a source that was actually
 * recorded for this company (UI-SPEC #24: "If an outreach claim has no
 * supporting source context, it should not be generated.").
 */
/**
 * Outreach drafts are versioned, not overwritten (OutreachRepository.
 * createDraft: "a regenerate creates the next version for the same
 * (lead_id, channel, step) rather than mutating a reviewed draft"). Any
 * code that displays, checks, or exports drafts must dedupe to the latest
 * version per (lead, channel, step) first, or it risks acting on a stale
 * draft while a newer, unreviewed version silently exists alongside it.
 * The lead id is part of the key so drafts for different companies are
 * not collapsed together when a whole run is exported at once.
 */
export type ExportScope = "approved" | "all";

export function parseExportScope(value: string | null): ExportScope {
  return value === "all" ? "all" : "approved";
}

/** Latest draft per channel/step, then drop anything not approved unless scope is all. */
export function draftsForExport(
  drafts: OutreachDraftRow[],
  scope: ExportScope,
): OutreachDraftRow[] {
  const latest = latestOutreachDrafts(drafts);
  if (scope === "all") return latest;
  return latest.filter((draft) => draft.review_state === "approved_for_export");
}

/**
 * Qualification-status filtering is a separate axis from `scope`'s
 * outreach-draft-approval gating — "all" here means every lead in the run
 * (qualified, not_qualified, needs_review), not just an unapproved qualified
 * one. Defaults to "qualified" so every existing call site is unaffected.
 */
export type LeadExportStatus = "qualified" | "all";

export function parseLeadExportStatus(value: string | null): LeadExportStatus {
  return value === "all" ? "all" : "qualified";
}

export function leadsForExport<
  T extends { id: string; qualification_status: string },
>(
  leads: T[],
  drafts: OutreachDraftRow[],
  scope: ExportScope,
  status: LeadExportStatus = "qualified",
): T[] {
  if (status === "all") return leads;
  const qualified = leads.filter(
    (lead) => lead.qualification_status === "qualified",
  );
  if (scope === "all") return qualified;
  const approvedLeadIds = new Set(
    draftsForExport(drafts, "approved").map((draft) => draft.lead_id),
  );
  return qualified.filter((lead) => approvedLeadIds.has(lead.id));
}

export function latestOutreachDrafts(
  drafts: OutreachDraftRow[],
): OutreachDraftRow[] {
  const latest = new Map<string, OutreachDraftRow>();
  for (const draft of drafts) {
    const key = `${draft.lead_id}:${draft.channel}:${draft.step ?? "linkedin"}`;
    const existing = latest.get(key);
    if (!existing || draft.version > existing.version) {
      latest.set(key, draft);
    }
  }
  return Array.from(latest.values());
}

export function assertClaimsReferenceKnownSources(
  claims: { source_id: string }[],
  knownSourceIds: ReadonlySet<string>,
) {
  for (const claim of claims) {
    if (!knownSourceIds.has(claim.source_id)) {
      throw new AppError(
        "EVIDENCE_REQUIRED",
        "A personalization claim references a source that was not recorded for this company.",
      );
    }
  }
}
