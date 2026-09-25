import { AppError } from "@/domain/shared/errors";

/**
 * Amount that may be added to a run's recorded spend. Invalid, missing, or
 * negative provider figures are treated as zero so a bad payload cannot
 * drive the ledger backward or fail a run after the work already happened.
 */
export function payableCost(amount: number | null | undefined): number {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return 0;
  }
  return amount;
}

/** Repository boundary: a caller must not ask the database to subtract. */
export function assertNonNegativeCostDelta(amount: number): void {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
    throw new AppError("INVALID_INPUT", "Cost must be a non-negative amount.");
  }
}

export type RecordedSpend = {
  discoveryUsd: number;
  agentUsd: number;
  totalUsd: number;
};

function readUsd(value: number | string | null | undefined): number {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return amount;
}

/**
 * Client-facing spend. Only the three amounts — never tokens, request
 * bodies, or provider error text.
 */
export function recordedSpend(run: {
  discovery_cost_usd: number | string | null;
  agent_cost_usd: number | string | null;
}): RecordedSpend {
  const discoveryUsd = readUsd(run.discovery_cost_usd);
  const agentUsd = readUsd(run.agent_cost_usd);
  return {
    discoveryUsd,
    agentUsd,
    totalUsd: discoveryUsd + agentUsd,
  };
}
