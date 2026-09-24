import { describe, expect, it } from "vitest";

import { AppError } from "@/domain/shared/errors";
import type { IcpCriteria } from "@/infrastructure/supabase/types";
import { assertConfidenceInRange, assertHardFiltersNotViolated } from "./lead";

describe("assertConfidenceInRange", () => {
  it("accepts boundary and mid-range values (TEST-PLAN.md LEAD-004)", () => {
    expect(() => assertConfidenceInRange(0)).not.toThrow();
    expect(() => assertConfidenceInRange(50)).not.toThrow();
    expect(() => assertConfidenceInRange(100)).not.toThrow();
  });

  it("rejects out-of-range values", () => {
    expect(() => assertConfidenceInRange(-1)).toThrow(AppError);
    expect(() => assertConfidenceInRange(101)).toThrow(AppError);
  });

  it("allows a missing confidence score (needs_review case)", () => {
    expect(() => assertConfidenceInRange(null)).not.toThrow();
    expect(() => assertConfidenceInRange(undefined)).not.toThrow();
  });
});

describe("assertHardFiltersNotViolated", () => {
  const criteria: IcpCriteria = {
    hard_filters: ["US-based", "10-100 employees"],
    soft_signals: [],
    employee_range: { min: 10, max: 100 },
  };

  it("blocks qualifying a company with a known employee count outside the hard filter range (AGENTS.md #31)", () => {
    expect(() =>
      assertHardFiltersNotViolated("qualified", criteria, {
        employee_count: 500,
      }),
    ).toThrow(AppError);
  });

  it("allows qualifying when the known employee count is within range", () => {
    expect(() =>
      assertHardFiltersNotViolated("qualified", criteria, {
        employee_count: 45,
      }),
    ).not.toThrow();
  });

  it("does not block when employee count is unknown — that's a reasoning concern, not a deterministic one", () => {
    expect(() =>
      assertHardFiltersNotViolated("qualified", criteria, {}),
    ).not.toThrow();
  });

  it("never blocks a not_qualified or needs_review decision", () => {
    expect(() =>
      assertHardFiltersNotViolated("not_qualified", criteria, {
        employee_count: 500,
      }),
    ).not.toThrow();
    expect(() =>
      assertHardFiltersNotViolated("needs_review", criteria, {
        employee_count: 500,
      }),
    ).not.toThrow();
  });
});
