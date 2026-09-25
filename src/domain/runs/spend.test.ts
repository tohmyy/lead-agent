import { describe, expect, it } from "vitest";

import { AppError } from "@/domain/shared/errors";
import {
  assertNonNegativeCostDelta,
  payableCost,
  recordedSpend,
} from "./spend";

describe("recorded spend", () => {
  it("sums discovery and agent amounts and ignores other fields", () => {
    const spend = recordedSpend({
      discovery_cost_usd: 1.25,
      agent_cost_usd: "0.50",
    });

    expect(spend).toEqual({
      discoveryUsd: 1.25,
      agentUsd: 0.5,
      totalUsd: 1.75,
    });
    expect(Object.keys(spend).sort()).toEqual([
      "agentUsd",
      "discoveryUsd",
      "totalUsd",
    ]);
  });

  it("does not surface a negative stored amount", () => {
    expect(
      recordedSpend({
        discovery_cost_usd: -2,
        agent_cost_usd: 1,
      }),
    ).toEqual({
      discoveryUsd: 0,
      agentUsd: 1,
      totalUsd: 1,
    });
  });

  it("treats a negative provider delta as unpaid and rejects it at the ledger boundary", () => {
    expect(payableCost(-0.4)).toBe(0);
    expect(payableCost(0.4)).toBe(0.4);
    expect(() => assertNonNegativeCostDelta(-0.4)).toThrow(AppError);
    expect(() => assertNonNegativeCostDelta(0)).not.toThrow();
  });
});
