import { z } from "zod";

import { AppError } from "@/domain/shared/errors";

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
