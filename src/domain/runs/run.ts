import { z } from "zod";

import { AppError } from "@/domain/shared/errors";
import type { RunRow, RunStatus } from "@/infrastructure/supabase/types";

export const RUN_STATUSES: RunStatus[] = [
  "draft",
  "awaiting_icp_approval",
  "researching",
  "generating_outreach",
  "awaiting_review",
  "completed",
  "failed",
  "cancelled",
];

/** States in which the run may still accept new tool calls (BUILD-PLAN section 12). */
const ACTIVE_STATUSES: ReadonlySet<RunStatus> = new Set([
  "awaiting_icp_approval",
  "researching",
  "generating_outreach",
]);

export function isRunActive(status: RunStatus): boolean {
  return ACTIVE_STATUSES.has(status);
}

/**
 * Allowed transitions (data-model.md section 5.1 / BUILD-PLAN section 12).
 * `failed` and `cancelled` are reachable from any active state, handled
 * separately rather than listed per-state below.
 */
const ALLOWED_TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  draft: ["awaiting_icp_approval"],
  awaiting_icp_approval: ["researching"],
  researching: ["generating_outreach", "researching"],
  generating_outreach: ["awaiting_review"],
  awaiting_review: ["completed"],
  completed: [],
  failed: [],
  cancelled: [],
};

export function assertValidTransition(from: RunStatus, to: RunStatus): void {
  if (to === "failed" || to === "cancelled") {
    if (!isRunActive(from) && from !== "draft") {
      throw new AppError(
        "RUN_NOT_ACTIVE",
        `Cannot transition a ${from} run to ${to}.`,
      );
    }
    return;
  }

  if (!ALLOWED_TRANSITIONS[from]?.includes(to)) {
    throw new AppError(
      "RUN_NOT_ACTIVE",
      `Invalid run state transition: ${from} -> ${to}.`,
    );
  }
}

export const createRunInputSchema = z
  .object({
    objective: z
      .string()
      .trim()
      .min(10, "Describe the objective in more detail."),
    qualifiedTarget: z.number().int().positive(),
    discoveryLimit: z.number().int().positive(),
  })
  .refine((v) => v.discoveryLimit >= v.qualifiedTarget, {
    message: "discoveryLimit must be greater than or equal to qualifiedTarget.",
    path: ["discoveryLimit"],
  });

export type CreateRunInput = z.infer<typeof createRunInputSchema>;

/** Mirrors the DB CHECK constraints (data-model.md section 5.2) in application code. */
export function assertRunLimitsValid(
  run: Pick<RunRow, "qualified_target" | "discovery_limit">,
) {
  if (run.qualified_target <= 0) {
    throw new AppError("INVALID_INPUT", "qualified_target must be positive.");
  }
  if (run.discovery_limit <= 0) {
    throw new AppError("INVALID_INPUT", "discovery_limit must be positive.");
  }
  if (run.discovery_limit < run.qualified_target) {
    throw new AppError(
      "INVALID_INPUT",
      "discovery_limit must be greater than or equal to qualified_target.",
    );
  }
}

/**
 * Discovery limit math (TOOLS-CONTRACT.md section 12) — the single source
 * of truth for how many more companies may be discovered right now. Never
 * trust an agent- or client-supplied limit; always derive from this.
 */
export function computeEffectiveDiscoveryLimit(
  run: Pick<
    RunRow,
    | "discovery_limit"
    | "discovered_count"
    | "qualified_count"
    | "qualified_target"
  >,
  requestedInternalLimit: number,
): number {
  if (run.qualified_count >= run.qualified_target) {
    throw new AppError(
      "TARGET_ALREADY_REACHED",
      "The qualified lead target has already been reached; no further discovery is needed.",
    );
  }

  const remaining = run.discovery_limit - run.discovered_count;
  if (remaining <= 0) {
    throw new AppError(
      "DISCOVERY_LIMIT_EXCEEDED",
      "This run has reached its discovery limit.",
    );
  }

  return Math.max(0, Math.min(requestedInternalLimit, remaining));
}

export function isDiscoveryLimitReached(
  run: Pick<RunRow, "discovery_limit" | "discovered_count">,
): boolean {
  return run.discovered_count >= run.discovery_limit;
}

export function isQualifiedTargetReached(
  run: Pick<RunRow, "qualified_count" | "qualified_target">,
): boolean {
  return run.qualified_count >= run.qualified_target;
}

/** Exact match key for "you've run this objective before". No fuzzy search. */
export function normalizeObjective(objective: string): string {
  return objective.trim().replace(/\s+/g, " ").toLowerCase();
}

export function findDuplicateRun<
  T extends { id: string; objective: string; created_at: string },
>(runs: T[], objective: string): T | null {
  const needle = normalizeObjective(objective);
  const matches = runs.filter(
    (run) => normalizeObjective(run.objective) === needle,
  );
  if (matches.length === 0) return null;
  return (
    matches.sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
  );
}

/**
 * Continue-anyway is an explicit second submit. Without that flag, an
 * exact normalized match blocks creation so a paid run is not started
 * by accident.
 */
export function resolveCreateDecision(input: {
  continueAnyway: boolean;
  existing: Array<{ id: string; objective: string; created_at: string }>;
  objective: string;
}): { action: "create" } | { action: "block"; matchId: string } {
  if (input.continueAnyway) return { action: "create" };
  const match = findDuplicateRun(input.existing, input.objective);
  if (!match) return { action: "create" };
  return { action: "block", matchId: match.id };
}
