import "server-only";

import { IcpRepository } from "@/infrastructure/supabase/repositories/icp-repository";
import { RunRepository } from "@/infrastructure/supabase/repositories/run-repository";
import type { ToolContext } from "./tool-context";
import { defineRunTool } from "./tool-runner";

const runRepo = new RunRepository();
const icpRepo = new IcpRepository();

/**
 * get_run_context (TOOLS-CONTRACT.md section 7): the agent's window into
 * authoritative run state. Counters and limits always come straight from
 * the database, never from anything the agent said earlier in the
 * conversation.
 */
export function createGetRunContextTool(ctx: ToolContext) {
  return defineRunTool({
    name: "get_run_context",
    description:
      "Returns the current run's objective, status, qualified/discovery limits and counts, and the approved ICP (if any). Call this whenever you need to check the run's authoritative constraints — never assume limits from earlier in the conversation.",
    shape: {},
    purpose: "Read authoritative run context.",
    runId: ctx.runId,
    execute: async () => {
      const run = await runRepo.getOwnedRun(ctx.runId, ctx.userId);
      const approvedIcp = await icpRepo.getApproved(ctx.runId);
      return {
        run_id: run.id,
        objective: run.objective,
        status: run.status,
        qualified_target: run.qualified_target,
        discovery_limit: run.discovery_limit,
        discovered_count: run.discovered_count,
        qualified_count: run.qualified_count,
        rejected_count: run.rejected_count,
        approved_icp: approvedIcp?.criteria ?? null,
      };
    },
  });
}
