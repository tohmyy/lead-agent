"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { IcpService } from "@/application/icp/icp-service";
import { RunOrchestrator } from "@/application/runs/run-orchestrator";
import { RunService } from "@/application/runs/run-service";
import { createRunInputSchema } from "@/domain/runs/run";
import type { IcpCriteriaInput } from "@/domain/icp/icp";
import { requireCurrentUserId } from "@/lib/auth/current-user";
import { getServerEnv } from "@/lib/config/env";
import { log } from "@/lib/logging/logger";

const runService = new RunService();
const icpService = new IcpService();
const orchestrator = new RunOrchestrator();

export interface RunFormState {
  error?: string;
}

/**
 * The orchestrator's agent turns are intentionally not awaited here — the
 * request returns as soon as the deterministic part (run creation, ICP
 * approval) is done, and the UI polls run/event state for progress. This
 * is the fire-and-forget simplification the implementation plan calls out
 * for the local/dev-first vertical slice (a production deployment behind a
 * serverless host would need a real background-job mechanism instead —
 * ARCHITECTURE2.md section 60).
 */
function fireAndForget(work: Promise<void>, label: string) {
  work.catch((err) => {
    log.error(`[orchestrator:${label}]`, {
      message: err instanceof Error ? err.message : String(err),
    });
  });
}

export async function createRun(
  _prevState: RunFormState,
  formData: FormData,
): Promise<RunFormState> {
  const userId = await requireCurrentUserId();

  const parsed = createRunInputSchema.safeParse({
    objective: String(formData.get("objective") ?? ""),
    qualifiedTarget: Number(formData.get("qualifiedTarget") ?? 10),
    discoveryLimit: Number(
      formData.get("discoveryLimit") ??
        getServerEnv().DEFAULT_DISCOVERY_LIMIT,
    ),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const run = await runService.createRun(userId, parsed.data);
  fireAndForget(orchestrator.refineIcp(run.id, userId), "refineIcp");

  redirect(`/runs/${run.id}`);
}

export async function approveIcp(runId: string, icpId: string): Promise<void> {
  const userId = await requireCurrentUserId();
  await icpService.approve(runId, userId, { icpId });
  fireAndForget(
    orchestrator.runResearchAndOutreach(runId, userId),
    "runResearchAndOutreach",
  );
  revalidatePath(`/runs/${runId}`);
}

export async function approveEditedIcp(
  runId: string,
  icpId: string,
  editedCriteria: IcpCriteriaInput,
): Promise<void> {
  const userId = await requireCurrentUserId();
  await icpService.approve(runId, userId, { icpId, editedCriteria });
  fireAndForget(
    orchestrator.runResearchAndOutreach(runId, userId),
    "runResearchAndOutreach",
  );
  revalidatePath(`/runs/${runId}`);
}

export async function regenerateIcp(runId: string): Promise<void> {
  const userId = await requireCurrentUserId();
  fireAndForget(orchestrator.refineIcp(runId, userId), "refineIcp");
  revalidatePath(`/runs/${runId}`);
}

export async function cancelRun(runId: string): Promise<void> {
  const userId = await requireCurrentUserId();
  await runService.cancel(runId, userId);
  revalidatePath(`/runs/${runId}`);
}
