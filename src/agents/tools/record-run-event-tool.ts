import "server-only";

import { z } from "zod";

import { RunEventRepository } from "@/infrastructure/supabase/repositories/run-event-repository";
import { RunRepository } from "@/infrastructure/supabase/repositories/run-repository";
import type { RunEventType } from "@/infrastructure/supabase/types";
import type { ToolContext } from "./tool-context";
import { defineRunTool } from "./tool-runner";

const runEventRepo = new RunEventRepository();
const runRepo = new RunRepository();

/** Canonical run_events vocabulary — data-model.md section 31 (see the implementation plan's conflict resolution). */
const RUN_EVENT_TYPES = [
  "run_created",
  "icp_refined",
  "icp_approved",
  "discovery_started",
  "discovery_completed",
  "company_research_started",
  "company_research_completed",
  "lead_qualified",
  "lead_rejected",
  "outreach_started",
  "outreach_completed",
  "run_completed",
  "run_failed",
  "run_cancelled",
] as const satisfies readonly RunEventType[];

/**
 * record_run_event (TOOLS-CONTRACT.md section 36-37): optional narration
 * for the human-readable activity feed, distinct from tool_calls (which are
 * logged automatically regardless of whether the agent calls this). Most
 * event types are already recorded by the application services themselves
 * at the relevant point in the workflow; this exists for the agent to add
 * color commentary the services wouldn't otherwise produce.
 */
export function createRecordRunEventTool(ctx: ToolContext) {
  return defineRunTool({
    name: "record_run_event",
    description:
      "Adds a concise, human-readable entry to the run's activity feed. Use sparingly for context the application wouldn't otherwise record — most workflow milestones are already logged automatically. Never include credentials or raw provider payloads.",
    shape: {
      event_type: z.enum(RUN_EVENT_TYPES),
      message: z.string().min(1).max(300),
    },
    purpose: "Record a human-readable activity event.",
    runId: ctx.runId,
    execute: async (args) => {
      await runRepo.getOwnedRun(ctx.runId, ctx.userId);
      const event = await runEventRepo.record({
        runId: ctx.runId,
        eventType: args.event_type,
        message: args.message,
      });
      return { event_id: event.id };
    },
  });
}
