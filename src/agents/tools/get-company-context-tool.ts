import "server-only";

import { z } from "zod";

import { QualificationService } from "@/application/qualification/qualification-service";
import { RunRepository } from "@/infrastructure/supabase/repositories/run-repository";
import type { ToolContext } from "./tool-context";
import { getCompanyContextOutputSchema } from "./tool-output-schemas";
import { defineRunTool } from "./tool-runner";

const qualificationService = new QualificationService();
const runRepo = new RunRepository();

/** get_company_context (TOOLS-CONTRACT.md section 26): read-only lookup before qualifying/outreach. */
export function createGetCompanyContextTool(ctx: ToolContext) {
  return defineRunTool({
    name: "get_company_context",
    description:
      "Retrieves everything persisted so far about a discovered company: its discovery metadata, all recorded evidence sources, and any existing qualification decision. Call this before save_lead or when drafting outreach, so personalization is grounded in what was actually recorded rather than invented.",
    shape: {
      company_id: z.string().uuid(),
    },
    outputSchema: getCompanyContextOutputSchema,
    purpose: "Read persisted company research context.",
    runId: ctx.runId,
    execute: async (args) => {
      const run = await runRepo.getOwnedRun(ctx.runId, ctx.userId);
      const context = await qualificationService.getCompanyContext(
        run,
        args.company_id,
      );
      return {
        company: {
          name: context.company.name,
          domain: context.company.domain,
          discovery_source: context.company.discoverySource,
          discovery_metadata: context.company.discoveryMetadata,
        },
        sources: context.sources,
        existing_lead: context.existingLead
          ? {
              lead_id: context.existingLead.id,
              qualification_status: context.existingLead.qualification_status,
              confidence_score: context.existingLead.confidence_score,
              fit_reasons: context.existingLead.fit_reasons,
              concerns: context.existingLead.concerns,
              qualification_reasoning:
                context.existingLead.qualification_reasoning,
            }
          : null,
      };
    },
  });
}
