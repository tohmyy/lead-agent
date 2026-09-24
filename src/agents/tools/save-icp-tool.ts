import "server-only";

import { z } from "zod";

import { IcpService } from "@/application/icp/icp-service";
import { icpCriteriaSchema } from "@/domain/icp/icp";
import { RunRepository } from "@/infrastructure/supabase/repositories/run-repository";
import type { ToolContext } from "./tool-context";
import { saveIcpOutputSchema } from "./tool-output-schemas";
import { defineRunTool } from "./tool-runner";

const icpService = new IcpService();
const runRepo = new RunRepository();

/**
 * save_icp (TOOLS-CONTRACT.md section 8-9): persists a refined ICP draft.
 * This tool can never approve an ICP — approval is a human action taken
 * through the application (AGENTS.md #29).
 */
export function createSaveIcpTool(ctx: ToolContext) {
  return defineRunTool({
    name: "save_icp",
    description:
      "Saves a refined Ideal Customer Profile (ICP) derived from the user's objective. This does NOT start company discovery and does NOT approve the ICP — a human must review and approve it in the application first. Call this once you've turned the objective into explicit hard_filters (mandatory constraints) and soft_signals (evidence of fit, not mandatory).",
    shape: {
      criteria: icpCriteriaSchema,
      reasoning: z
        .string()
        .min(1)
        .describe("Brief explanation of how the objective was interpreted."),
    },
    outputSchema: saveIcpOutputSchema,
    purpose: "Save refined ICP criteria.",
    runId: ctx.runId,
    execute: async (args) => {
      const run = await runRepo.getOwnedRun(ctx.runId, ctx.userId);
      const icp = await icpService.saveDraft(
        run,
        { criteria: args.criteria, reasoning: args.reasoning },
        "agent",
      );
      return {
        icp_id: icp.id,
        version: icp.version,
        status: "awaiting_approval",
      };
    },
  });
}
