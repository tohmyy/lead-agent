import "server-only";

import { AppError } from "@/domain/shared/errors";
import { icpCriteriaSchema, type IcpCriteriaInput } from "@/domain/icp/icp";
import { IcpRepository } from "@/infrastructure/supabase/repositories/icp-repository";
import { RunEventRepository } from "@/infrastructure/supabase/repositories/run-event-repository";
import { RunRepository } from "@/infrastructure/supabase/repositories/run-repository";
import type { RunIcpRow, RunRow } from "@/infrastructure/supabase/types";

/** Run states in which the ICP may still be (re)drafted — TOOLS-CONTRACT.md section 46: "Run is editable". */
const ICP_EDITABLE_STATUSES: ReadonlySet<RunRow["status"]> = new Set([
  "draft",
  "awaiting_icp_approval",
]);

export class IcpService {
  constructor(
    private readonly icps = new IcpRepository(),
    private readonly runs = new RunRepository(),
    private readonly events = new RunEventRepository(),
  ) {}

  /**
   * Called by the agent's save_icp tool. Never approves — see
   * TOOLS-CONTRACT.md section 9. `run` must already be authorization-checked
   * by the caller.
   */
  async saveDraft(
    run: RunRow,
    input: { criteria: IcpCriteriaInput; reasoning: string },
    source: "agent" | "user" = "agent",
  ): Promise<RunIcpRow> {
    if (!ICP_EDITABLE_STATUSES.has(run.status)) {
      throw new AppError(
        "RUN_NOT_ACTIVE",
        "This run's ICP can no longer be edited (research has already started).",
      );
    }

    const criteria = icpCriteriaSchema.parse(input.criteria);
    const icp = await this.icps.saveDraft({
      runId: run.id,
      criteria,
      reasoning: input.reasoning,
      source,
    });
    await this.events.record({
      runId: run.id,
      eventType: "icp_refined",
      message:
        source === "agent"
          ? "Agent refined the qualification objective into a structured ICP."
          : "ICP criteria updated.",
      metadata: { version: icp.version },
    });
    return icp;
  }

  async getLatest(runId: string): Promise<RunIcpRow | null> {
    return this.icps.getLatest(runId);
  }

  async getApproved(runId: string): Promise<RunIcpRow | null> {
    return this.icps.getApproved(runId);
  }

  async listVersions(runId: string): Promise<RunIcpRow[]> {
    return this.icps.listVersions(runId);
  }

  /**
   * Human approval (UI-SPEC.md section 8, AGENTS.md #29 "Do not silently
   * start expensive discovery before the user approves the refined ICP").
   * Optionally accepts edited criteria, which is persisted as a new
   * user-authored version before being approved (data-model.md section 8).
   */
  async approve(
    runId: string,
    userId: string,
    input: {
      icpId: string;
      editedCriteria?: IcpCriteriaInput;
      editedReasoning?: string;
    },
  ): Promise<RunIcpRow> {
    const run = await this.runs.getOwnedRun(runId, userId);
    if (run.status !== "awaiting_icp_approval") {
      throw new AppError(
        "RUN_NOT_ACTIVE",
        "This run is not awaiting ICP approval.",
      );
    }

    let targetIcpId = input.icpId;
    if (input.editedCriteria) {
      const edited = await this.saveDraft(
        run,
        {
          criteria: input.editedCriteria,
          reasoning: input.editedReasoning ?? "Edited by user before approval.",
        },
        "user",
      );
      targetIcpId = edited.id;
    }

    const approved = await this.icps.approve(runId, targetIcpId, userId);

    await this.runs.transitionStatus(
      runId,
      "awaiting_icp_approval",
      "researching",
      {
        started_at: run.started_at ?? new Date().toISOString(),
      },
    );

    await this.events.record({
      runId,
      eventType: "icp_approved",
      message: "ICP approved. Starting company research.",
      metadata: { version: approved.version },
    });

    return approved;
  }
}
