import "server-only";

import { z } from "zod";

import { OutreachService } from "@/application/outreach/outreach-service";
import {
  personalizationContextSchema,
  saveOutreachDraftInputSchema,
} from "@/domain/outreach/outreach";
import { RunRepository } from "@/infrastructure/supabase/repositories/run-repository";
import type { ToolContext } from "./tool-context";
import { defineRunTool } from "./tool-runner";

const outreachService = new OutreachService();
const runRepo = new RunRepository();

/**
 * save_outreach_draft (TOOLS-CONTRACT.md sections 31-35): persists a
 * review-ready draft for a QUALIFIED lead only. There is intentionally no
 * send_email/send_linkedin_message tool anywhere in this application —
 * this tool can only ever produce a draft for human review.
 */
export function createSaveOutreachDraftTool(ctx: ToolContext) {
  return defineRunTool({
    name: "save_outreach_draft",
    description:
      "Saves one outreach draft (an email step 1-3, or a LinkedIn message) for a qualified lead. Fails if the lead isn't qualified yet. Email drafts require step (1, 2, or 3) and subject; LinkedIn drafts must omit both. Every claim in personalization_context.claims must cite the source_id of evidence actually recorded for this company via record_source — never invent a fact or cite a source that doesn't exist. This only creates a draft for human review; nothing is ever sent.",
    shape: {
      lead_id: z.string().uuid(),
      channel: z.enum(["email", "linkedin"]),
      step: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
      subject: z.string().min(1).max(200).optional(),
      body: z.string().min(1).max(4000),
      personalization_context: personalizationContextSchema,
    },
    purpose: "Save an outreach draft for a qualified lead.",
    runId: ctx.runId,
    execute: async (args) => {
      const validated = saveOutreachDraftInputSchema.parse(args);
      const run = await runRepo.getOwnedRun(ctx.runId, ctx.userId);
      const draft = await outreachService.saveDraft(run, validated);
      return {
        outreach_draft_id: draft.id,
        channel: draft.channel,
        step: draft.step,
        version: draft.version,
      };
    },
  });
}
