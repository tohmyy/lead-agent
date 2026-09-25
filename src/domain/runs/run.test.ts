import { describe, expect, it } from "vitest";

import { AppError } from "@/domain/shared/errors";
import {
  assertRunLimitsValid,
  assertValidTransition,
  computeEffectiveDiscoveryLimit,
  findDuplicateRun,
  normalizeObjective,
  resolveCreateDecision,
} from "./run";

describe("assertRunLimitsValid", () => {
  it("accepts a valid target/limit pair", () => {
    expect(() =>
      assertRunLimitsValid({ qualified_target: 10, discovery_limit: 20 }),
    ).not.toThrow();
  });

  it("rejects a zero qualified_target (TEST-PLAN.md RUN-002)", () => {
    expect(() =>
      assertRunLimitsValid({ qualified_target: 0, discovery_limit: 20 }),
    ).toThrow(AppError);
  });

  it("rejects discovery_limit below qualified_target (TEST-PLAN.md RUN-003)", () => {
    expect(() =>
      assertRunLimitsValid({ qualified_target: 10, discovery_limit: 5 }),
    ).toThrow(AppError);
  });
});

describe("computeEffectiveDiscoveryLimit", () => {
  const baseRun = {
    discovery_limit: 30,
    discovered_count: 0,
    qualified_count: 0,
    qualified_target: 10,
  };

  it("caps the agent's requested limit to the run's remaining budget (TOOLS-CONTRACT.md section 12)", () => {
    // Agent effectively "asks for" far more than is allowed; the request
    // itself never reaches this function — the caller always passes a
    // small fixed chunk size — but this asserts the math holds regardless.
    const result = computeEffectiveDiscoveryLimit(
      { ...baseRun, discovered_count: 25 },
      1000,
    );
    expect(result).toBe(5);
  });

  it("throws DISCOVERY_LIMIT_EXCEEDED when no budget remains", () => {
    try {
      computeEffectiveDiscoveryLimit({ ...baseRun, discovered_count: 30 }, 10);
      expect.unreachable("expected computeEffectiveDiscoveryLimit to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("DISCOVERY_LIMIT_EXCEEDED");
    }
  });

  it("throws TARGET_ALREADY_REACHED when the qualified target is met, even with budget remaining", () => {
    try {
      computeEffectiveDiscoveryLimit(
        { ...baseRun, discovered_count: 5, qualified_count: 10 },
        10,
      );
      expect.unreachable("expected computeEffectiveDiscoveryLimit to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("TARGET_ALREADY_REACHED");
    }
  });
});

describe("assertValidTransition", () => {
  it("allows the documented happy path (data-model.md section 5.1)", () => {
    expect(() =>
      assertValidTransition("draft", "awaiting_icp_approval"),
    ).not.toThrow();
    expect(() =>
      assertValidTransition("awaiting_icp_approval", "researching"),
    ).not.toThrow();
    expect(() =>
      assertValidTransition("researching", "generating_outreach"),
    ).not.toThrow();
    expect(() =>
      assertValidTransition("generating_outreach", "awaiting_review"),
    ).not.toThrow();
    expect(() =>
      assertValidTransition("awaiting_review", "completed"),
    ).not.toThrow();
  });

  it("rejects skipping the ICP approval gate (draft -> researching)", () => {
    expect(() => assertValidTransition("draft", "researching")).toThrow(
      AppError,
    );
  });

  it("rejects transitioning a terminal run", () => {
    expect(() => assertValidTransition("completed", "researching")).toThrow(
      AppError,
    );
  });

  it("allows failing from any active state", () => {
    expect(() => assertValidTransition("researching", "failed")).not.toThrow();
    expect(() =>
      assertValidTransition("awaiting_icp_approval", "failed"),
    ).not.toThrow();
  });
});

describe("duplicate objectives", () => {
  const existing = [
    {
      id: "older",
      objective: "Find  US   B2B SaaS companies.",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "newer",
      objective: "find us b2b saas companies.",
      created_at: "2026-02-01T00:00:00.000Z",
    },
  ];

  it("treats whitespace and case differences as the same objective", () => {
    expect(normalizeObjective("  Find   US b2b SaaS companies. ")).toBe(
      "find us b2b saas companies.",
    );
    expect(findDuplicateRun(existing, "Find US B2B SaaS companies.")?.id).toBe(
      "newer",
    );
  });

  it("does not match a different objective", () => {
    expect(
      resolveCreateDecision({
        continueAnyway: false,
        existing,
        objective: "Find US agencies",
      }),
    ).toEqual({ action: "create" });
  });

  it("blocks an exact normalized match unless continue anyway is set", () => {
    expect(
      resolveCreateDecision({
        continueAnyway: false,
        existing,
        objective: "Find US B2B SaaS companies.",
      }),
    ).toEqual({ action: "block", matchId: "newer" });

    expect(
      resolveCreateDecision({
        continueAnyway: true,
        existing,
        objective: "Find US B2B SaaS companies.",
      }),
    ).toEqual({ action: "create" });
  });
});
