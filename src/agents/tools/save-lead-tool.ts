import "server-only";

import { QualificationService } from "@/application/qualification/qualification-service";
import { saveLeadInputSchema } from "@/domain/leads/lead";
import { RunRepository } from "@/infrastructure/supabase/repositories/run-repository";
import type { ToolContext } from "./tool-context";
import { saveLeadOutputSchema } from "./tool-output-schemas";
import { defineRunTool } from "./tool-runner";

const qualificationService = new QualificationService();
const runRepo = new RunRepository();

/**
 * save_lead (TOOLS-CONTRACT.md section 27-30): persists a qualification
 * decision. The application — not this tool's caller — has the final say
 * when deterministic evidence contradicts an approved hard filter
 * (AGENTS.md #31); the qualification-guidance skill covers how to reach
 * the decision, this tool only covers how it's recorded.
 */
export function createSaveLeadTool(ctx: ToolContext) {
  return defineRunTool({
    name: "save_lead",
    description:
      "Persists your qualification decision for a discovered company against the approved ICP. qualification_status must be 'qualified', 'not_qualified', or 'needs_review' (use needs_review when evidence is genuinely insufficient for a confident decision — do not force a binary call). Every fit_reason and concern must cite the source_ids of evidence actually recorded via record_source; do not cite a source that wasn't recorded. confidence_score (0-100) reflects confidence in THIS ASSESSMENT, not sales priority or likelihood to convert.",
    shape: saveLeadInputSchema.shape,
    outputSchema: saveLeadOutputSchema,
    purpose: "Save lead qualification decision.",
    runId: ctx.runId,
    execute: async (args) => {
      const run = await runRepo.getOwnedRun(ctx.runId, ctx.userId);
      const lead = await qualificationService.saveLead(run, args);
      return {
        lead_id: lead.id,
        qualification_status: lead.qualification_status,
        confidence_score: lead.confidence_score,
      };
    },
  });
}
