import { describe, expect, it } from "vitest";

import { AppError } from "@/domain/shared/errors";
import type { IcpCriteria } from "@/infrastructure/supabase/types";
import {
  assertConfidenceInRange,
  assertHardFilterResults,
  assertHardFiltersNotViolated,
  industryFromMetadata,
  locationFromMetadata,
  saveLeadInputSchema,
} from "./lead";

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

  it("rejects qualifying a company that failed an approved hard filter", () => {
    expect(() =>
      assertHardFilterResults({
        status: "qualified",
        approvedFilters: ["US-based", "B2B SaaS"],
        results: [
          { filter: "US-based", result: "pass" },
          { filter: "B2B SaaS", result: "fail" },
        ],
      }),
    ).toThrow(AppError);
  });

  it("allows a failed hard filter when the company is not qualified", () => {
    expect(() =>
      assertHardFilterResults({
        status: "not_qualified",
        approvedFilters: ["US-based"],
        results: [{ filter: "US-based", result: "fail" }],
      }),
    ).not.toThrow();
  });

  it("requires a result for every approved hard filter", () => {
    expect(() =>
      assertHardFilterResults({
        status: "qualified",
        approvedFilters: ["US-based", "B2B SaaS"],
        results: [{ filter: "US-based", result: "pass" }],
      }),
    ).toThrow(AppError);
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

describe("industryFromMetadata", () => {
  it("returns the industry when present", () => {
    expect(industryFromMetadata({ industry: "Fintech" })).toBe("Fintech");
  });

  it("returns null when missing", () => {
    expect(industryFromMetadata({})).toBeNull();
    expect(industryFromMetadata(null)).toBeNull();
    expect(industryFromMetadata(undefined)).toBeNull();
  });

  it("returns null for a blank or non-string value", () => {
    expect(industryFromMetadata({ industry: "   " })).toBeNull();
    expect(industryFromMetadata({ industry: 42 })).toBeNull();
  });
});

describe("locationFromMetadata", () => {
  it("returns the location when present", () => {
    expect(locationFromMetadata({ location: "Austin, TX" })).toBe(
      "Austin, TX",
    );
  });

  it("returns null when missing or malformed", () => {
    expect(locationFromMetadata({})).toBeNull();
    expect(locationFromMetadata({ location: "" })).toBeNull();
    expect(locationFromMetadata({ location: 7 })).toBeNull();
  });
});

describe("saveLeadInputSchema research_metadata", () => {
  const SOURCE_ID = "11111111-1111-4111-8111-111111111111";
  const basePayload = {
    company_id: "22222222-2222-4222-8222-222222222222",
    qualification_status: "qualified" as const,
    confidence_score: 80,
    fit_reasons: [
      {
        reason: "Matches ICP",
        source_ids: [SOURCE_ID],
      },
    ],
    concerns: [],
    hard_filter_results: [],
    qualification_reasoning: "Fits the approved criteria.",
    source_summary: "Reviewed the company homepage.",
  };

  it("accepts research_metadata with industry and location", () => {
    const parsed = saveLeadInputSchema.safeParse({
      ...basePayload,
      research_metadata: {
        employee_count: 50,
        industry: "Fintech",
        location: "Austin, TX",
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("still accepts an old-shaped payload with only employee_count (pre-upgrade leads)", () => {
    const parsed = saveLeadInputSchema.safeParse({
      ...basePayload,
      research_metadata: { employee_count: 50 },
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a payload with no research_metadata at all", () => {
    const parsed = saveLeadInputSchema.safeParse(basePayload);
    expect(parsed.success).toBe(true);
  });
});
