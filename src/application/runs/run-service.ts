import "server-only";

import { AppError } from "@/domain/shared/errors";
import { assertRunLimitsValid, type CreateRunInput } from "@/domain/runs/run";
import { RunEventRepository } from "@/infrastructure/supabase/repositories/run-event-repository";
import { RunRepository } from "@/infrastructure/supabase/repositories/run-repository";
import type { RunRow } from "@/infrastructure/supabase/types";
import { getServerEnv } from "@/lib/config/env";

export class RunService {
  constructor(
    private readonly runs = new RunRepository(),
    private readonly events = new RunEventRepository(),
  ) {}

  async createRun(userId: string, input: CreateRunInput): Promise<RunRow> {
    const env = getServerEnv();
    if (input.discoveryLimit > env.MAX_DISCOVERY_LIMIT) {
      throw new AppError(
        "INVALID_INPUT",
        `discoveryLimit cannot exceed the configured maximum of ${env.MAX_DISCOVERY_LIMIT}.`,
      );
    }
    assertRunLimitsValid({
      qualified_target: input.qualifiedTarget,
      discovery_limit: input.discoveryLimit,
    });

    const run = await this.runs.create({
      userId,
      objective: input.objective,
      qualifiedTarget: input.qualifiedTarget,
      discoveryLimit: input.discoveryLimit,
    });

    await this.events.record({
      runId: run.id,
      eventType: "run_created",
      message: "Research run created.",
      metadata: {
        qualified_target: input.qualifiedTarget,
        discovery_limit: input.discoveryLimit,
      },
    });

    return run;
  }

  async getOwnedRun(runId: string, userId: string): Promise<RunRow> {
    return this.runs.getOwnedRun(runId, userId);
  }

  async listRunsForUser(userId: string): Promise<RunRow[]> {
    return this.runs.listForUser(userId);
  }

  async markFailed(
    runId: string,
    from: RunRow["status"],
    message: string,
  ): Promise<void> {
    await this.runs.transitionStatus(runId, from, "failed", {
      error_message: message,
      completed_at: new Date().toISOString(),
    });
    await this.events.record({
      runId,
      eventType: "run_failed",
      message,
    });
  }

  async cancel(runId: string, userId: string): Promise<RunRow> {
    const run = await this.runs.getOwnedRun(runId, userId);
    const updated = await this.runs.transitionStatus(
      runId,
      run.status,
      "cancelled",
      {
        completed_at: new Date().toISOString(),
      },
    );
    await this.events.record({
      runId,
      eventType: "run_cancelled",
      message: "Run cancelled by user. Existing progress was preserved.",
    });
    return updated;
  }

  async complete(runId: string, userId: string): Promise<RunRow> {
    const run = await this.runs.getOwnedRun(runId, userId);
    const updated = await this.runs.transitionStatus(
      runId,
      run.status,
      "completed",
      {
        completed_at: new Date().toISOString(),
      },
    );
    await this.events.record({
      runId,
      eventType: "run_completed",
      message: "Run marked complete by user.",
    });
    return updated;
  }
}
