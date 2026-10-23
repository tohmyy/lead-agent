import { isDiscoveryLimitReached, isRunActive } from "@/domain/runs/run";
import type {
  LeadRow,
  LeadSourceRow,
  RunEventRow,
  RunEventType,
  RunRow,
  RunStatus,
} from "@/infrastructure/supabase/types";

export type RunStage =
  | "understanding_request"
  | "waiting_icp_approval"
  | "finding_companies"
  | "researching_companies"
  | "writing_outreach"
  | "ready_for_review"
  | "failed"
  | "cancelled";

export const STAGE_LABELS: Record<RunStage, string> = {
  understanding_request: "Understanding the request",
  waiting_icp_approval: "Waiting for ICP approval",
  finding_companies: "Finding companies",
  researching_companies: "Researching companies",
  writing_outreach: "Writing outreach",
  ready_for_review: "Ready for review",
  failed: "Failed",
  cancelled: "Cancelled",
};

/** Linear pipeline order for a visual stepper. Terminal interruptions
 * (failed/cancelled) are deliberately excluded — they aren't steps. */
export const STAGE_ORDER: RunStage[] = [
  "understanding_request",
  "waiting_icp_approval",
  "finding_companies",
  "researching_companies",
  "writing_outreach",
  "ready_for_review",
];

const RESEARCHING_EVENT_TYPES: ReadonlySet<RunEventType> = new Set([
  "company_research_started",
  "company_research_completed",
  "company_research_failed",
  "lead_qualified",
  "lead_rejected",
]);

/** Stage label from run status plus the latest event type (Phase 1 plan doc). */
export function deriveStage(
  status: RunStatus,
  latestEventType: RunEventType | null,
): RunStage {
  switch (status) {
    case "draft":
      return "understanding_request";
    case "awaiting_icp_approval":
      return "waiting_icp_approval";
    case "researching":
      return latestEventType && RESEARCHING_EVENT_TYPES.has(latestEventType)
        ? "researching_companies"
        : "finding_companies";
    case "generating_outreach":
      return "writing_outreach";
    case "awaiting_review":
    case "completed":
      return "ready_for_review";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
  }
}

/** Companies with at least one recorded source count as "researched". */
export function researchedCount(
  sourcesByCompany: Record<string, LeadSourceRow[]>,
): number {
  return Object.values(sourcesByCompany).filter((rows) => rows.length > 0)
    .length;
}

/** The latest run_events message, shown only while the run is still active. */
export function currentActivity(
  run: Pick<RunRow, "status">,
  events: RunEventRow[],
): string | null {
  if (!isRunActive(run.status)) return null;
  return events.at(-1)?.message ?? null;
}

/** Substring check, not structured parsing — matches run-orchestrator.ts's actual wording. */
export function hasQualityIssueMention(message: string): boolean {
  return message.toLowerCase().includes("quality");
}

export type RunProgressBanners = {
  failed: { message: string } | null;
  targetShortfall: boolean;
  discoveryCapReached: boolean;
  qualityIssueMessage: string | null;
};

export type RunProgress = {
  stage: RunStage;
  stageLabel: string;
  currentActivity: string | null;
  researchedCount: number;
  qualifiedCount: number;
  qualifiedTarget: number;
  discoveredCount: number;
  discoveryLimit: number;
  rejectedCount: number;
  banners: RunProgressBanners;
  /** Run is waiting on a human action, or has a lead flagged for review. */
  needsAttention: boolean;
};

const LEFT_RESEARCH_STATUSES: ReadonlySet<RunStatus> = new Set([
  "generating_outreach",
  "awaiting_review",
  "completed",
]);

export function computeRunProgress(input: {
  run: RunRow;
  events: RunEventRow[];
  sourcesByCompany: Record<string, LeadSourceRow[]>;
  leads?: LeadRow[];
}): RunProgress {
  const { run, events, sourcesByCompany, leads = [] } = input;
  const latestEventType = events.at(-1)?.event_type ?? null;
  const stage = deriveStage(run.status, latestEventType);
  const needsAttention =
    run.status === "awaiting_icp_approval" ||
    run.status === "awaiting_review" ||
    leads.some((l) => l.qualification_status === "needs_review");

  const targetShortfall =
    LEFT_RESEARCH_STATUSES.has(run.status) &&
    run.qualified_count < run.qualified_target;

  const discoveryCapReached =
    isDiscoveryLimitReached(run) && run.qualified_count < run.qualified_target;

  const lastCompletedEvent = [...events]
    .reverse()
    .find((event) => event.event_type === "run_completed");
  const qualityIssueMessage =
    lastCompletedEvent && hasQualityIssueMention(lastCompletedEvent.message)
      ? lastCompletedEvent.message
      : null;

  return {
    stage,
    stageLabel: STAGE_LABELS[stage],
    currentActivity: currentActivity(run, events),
    researchedCount: researchedCount(sourcesByCompany),
    qualifiedCount: run.qualified_count,
    qualifiedTarget: run.qualified_target,
    discoveredCount: run.discovered_count,
    discoveryLimit: run.discovery_limit,
    rejectedCount: run.rejected_count,
    banners: {
      failed:
        run.status === "failed"
          ? { message: run.error_message ?? "The agent could not finish this run." }
          : null,
      targetShortfall,
      discoveryCapReached,
      qualityIssueMessage,
    },
    needsAttention,
  };
}
