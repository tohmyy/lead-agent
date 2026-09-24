import { z } from "zod";

import { AppError } from "@/domain/shared/errors";
import type { IcpCriteria } from "@/infrastructure/supabase/types";

export const QUALIFICATION_STATUSES = [
  "qualified",
  "not_qualified",
  "needs_review",
] as const;

const fitReasonSchema = z.object({
  reason: z.string().min(1),
  evidence: z.string().optional(),
  source_ids: z
    .array(z.string().uuid())
    .min(1, "Every fit reason needs at least one source."),
});

const concernSchema = z.object({
  concern: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
  source_ids: z.array(z.string().uuid()),
});

/**
 * save_lead input (TOOLS-CONTRACT.md section 27, merged with data-model.md's
 * structured fit_reasons/concerns per the implementation plan's conflict
 * resolution — plain strings would lose the evidence trail).
 */
export const saveLeadInputSchema = z.object({
  company_id: z.string().uuid(),
  qualification_status: z.enum(QUALIFICATION_STATUSES),
  confidence_score: z.number().min(0).max(100).nullable().optional(),
  fit_reasons: z.array(fitReasonSchema),
  concerns: z.array(concernSchema),
  qualification_reasoning: z.string().min(1),
  source_summary: z.string().min(1),
  /**
   * Optional structured signals extracted during research (e.g. employee
   * count) that the application can cross-check deterministically against
   * hard filters — see assertHardFiltersNotViolated below.
   *
   * Deliberately a concrete object, not `z.record(...)`: the Claude Agent
   * SDK's tool registration silently drops every tool on an MCP server
   * (not just this one) when any registered tool's input schema contains
   * a `z.record()` — confirmed by isolated reproduction. Add new known
   * fields here explicitly rather than reintroducing an open dictionary.
   */
  research_metadata: z
    .object({
      employee_count: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

export type SaveLeadInput = z.infer<typeof saveLeadInputSchema>;

/**
 * Confidence score semantics (data-model.md section 19 / AGENTS.md #30):
 * confidence in the *assessment*, not conversion probability, sales value,
 * or company quality. This function only enforces the numeric range; the
 * semantic distinction is enforced through the qualification skill prompt.
 */
export function assertConfidenceInRange(score: number | null | undefined) {
  if (score === null || score === undefined) return;
  if (score < 0 || score > 100) {
    throw new AppError(
      "INVALID_INPUT",
      "confidence_score must be between 0 and 100.",
    );
  }
}

/**
 * Hard-filter enforcement (AGENTS.md #31, TOOLS-CONTRACT.md section 29):
 * the application — not the agent's own judgment — has the final say when
 * deterministic evidence contradicts an approved hard filter. Currently
 * enforces the one hard filter that can be checked deterministically from
 * structured data: employee range, when research_metadata reports an
 * employee count. Geography/business-model/industry hard filters require
 * interpreting free-text evidence and remain an agent-reasoning concern
 * per AGENTS.md #76 ("is this a reasoning problem or a deterministic one?").
 */
export function assertHardFiltersNotViolated(
  status: (typeof QUALIFICATION_STATUSES)[number],
  criteria: IcpCriteria,
  researchMetadata: { employee_count?: number } | null | undefined,
) {
  if (status !== "qualified") return;

  const employeeCount = researchMetadata?.employee_count;
  const range = criteria.employee_range;
  if (typeof employeeCount === "number" && range) {
    if (
      (typeof range.min === "number" && employeeCount < range.min) ||
      (typeof range.max === "number" && employeeCount > range.max)
    ) {
      throw new AppError(
        "SAFETY_VALIDATION_FAILED",
        "This company's known employee count falls outside the approved ICP's hard employee-range filter; it cannot be marked qualified.",
      );
    }
  }
}
