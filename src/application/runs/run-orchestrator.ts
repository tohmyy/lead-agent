import "server-only";

import { assertAgentTurnSucceeded, runAgentTurn } from "@/agents/agent-runtime";
import { IcpService } from "@/application/icp/icp-service";
import { LeadRepository } from "@/infrastructure/supabase/repositories/lead-repository";
import { OutreachRepository } from "@/infrastructure/supabase/repositories/outreach-repository";
import { RunEventRepository } from "@/infrastructure/supabase/repositories/run-event-repository";
import { RunRepository } from "@/infrastructure/supabase/repositories/run-repository";

const MAX_TURNS_ICP = 8;
const MAX_BUDGET_ICP_USD = 0.5;

const MAX_TURNS_RESEARCH = 80;
const MAX_BUDGET_RESEARCH_USD = 5;

const MAX_TURNS_OUTREACH = 40;
const MAX_BUDGET_OUTREACH_USD = 3;

/**
 * Drives the run through its lifecycle with 3 bounded agent turns
 * (BUILD-PLAN.md section 37-38's control loop, "Application-level guards
 * must remain authoritative"). Deciding *when* to stop each stage and
 * *whether* to advance to the next is done here, deterministically, by
 * inspecting database state after each agent turn — never by trusting the
 * agent's own narration of what it did.
 *
 * Runs fire-and-forget from the server action that triggers them (create
 * run, approve ICP) so the HTTP response returns quickly; the UI polls run
 * state instead of blocking on this. This is a known simplification for
 * the local/dev-first vertical slice — see the implementation plan's
 * "Deferred to a follow-up pass" note on background execution for
 * serverless deployment.
 */
export class RunOrchestrator {
  constructor(
    private readonly runs = new RunRepository(),
    private readonly icps = new IcpService(),
    private readonly events = new RunEventRepository(),
    private readonly outreach = new OutreachRepository(),
    private readonly leads = new LeadRepository(),
  ) {}

  /** Stage 1: objective -> draft ICP. Called right after run creation. */
  async refineIcp(runId: string, userId: string): Promise<void> {
    try {
      const run = await this.runs.getOwnedRun(runId, userId);
      await this.runs.transitionStatus(
        runId,
        run.status,
        "awaiting_icp_approval",
      );

      const result = await runAgentTurn(
        { runId, userId },
        {
          task: [
            `Qualification objective: "${run.objective}"`,
            "Call save_icp right now, in this turn, with your refined criteria — hard_filters, soft_signals, and the other fields it accepts. Do not write out the ICP as text first and do not ask for confirmation; save_icp is reviewed by a human afterward, so there is no risk in calling it immediately.",
          ].join("\n"),
          maxTurns: MAX_TURNS_ICP,
          maxBudgetUsd: MAX_BUDGET_ICP_USD,
        },
      );
      assertAgentTurnSucceeded(result, "ICP refinement");

      const saved = await this.icps.getLatest(runId);
      if (!saved) {
        throw new Error("Agent did not produce an ICP.");
      }
    } catch (err) {
      const current = await this.runs
        .getOwnedRun(runId, userId)
        .catch(() => null);
      if (current && current.status === "awaiting_icp_approval") {
        await this.fail(
          runId,
          "awaiting_icp_approval",
          errorMessage(err, "ICP refinement failed."),
        );
      }
    }
  }

  /**
   * Stage 2 + 3: called after the user approves the ICP. Runs the bounded
   * discover -> research -> qualify loop, then a separate bounded outreach
   * generation turn, then transitions to awaiting_review.
   */
  async runResearchAndOutreach(runId: string, userId: string): Promise<void> {
    try {
      const researchingRun = await this.runs.getOwnedRun(runId, userId);
      if (researchingRun.status !== "researching") return;

      const researchResult = await runAgentTurn(
        { runId, userId },
        {
          task: [
            "The ICP for this run has just been approved. Research and qualify companies:",
            "1. Call get_run_context to see the qualified_target and current counts.",
            "2. Call discover_companies for candidates matching the approved ICP.",
            "3. For each newly discovered company: call research_website, then record_source for evidence worth keeping, then get_company_context, then save_lead with your qualification decision.",
            "4. Keep discovering/researching/qualifying more candidates until qualified_count reaches qualified_target, or a tool returns DISCOVERY_LIMIT_EXCEEDED / TARGET_ALREADY_REACHED and there are no more already-discovered, unqualified companies left to research.",
            "5. Do not generate outreach in this turn — that happens separately.",
          ].join("\n"),
          maxTurns: MAX_TURNS_RESEARCH,
          maxBudgetUsd: MAX_BUDGET_RESEARCH_USD,
        },
      );
      assertAgentTurnSucceeded(researchResult, "research and qualification");

      const afterResearch = await this.runs.getOwnedRun(runId, userId);
      await this.runs.transitionStatus(
        runId,
        "researching",
        "generating_outreach",
      );

      if (afterResearch.qualified_count > 0) {
        // The outreach turn is a fresh agent conversation with no memory
        // of the research turn's discover_companies results — and no tool
        // in the 9-tool contract lets an agent enumerate "which companies
        // are qualified" (get_run_context returns only counts;
        // discover_companies is correctly blocked once the run leaves
        // "researching"). Confirmed live: without the company_ids handed
        // to it directly, the agent correctly refuses the task instead of
        // inventing an ID, and no drafts get created. So the
        // (trusted, server-side) orchestrator resolves them itself.
        const qualifiedLeads = (await this.leads.listForRun(runId))
          .filter((lead) => lead.qualification_status === "qualified")
          .map((lead) => ({
            lead_id: lead.id,
            company_id: lead.discovered_company_id,
          }));

        const outreachResult = await runAgentTurn(
          { runId, userId },
          {
            task: [
              "Generate outreach for every qualified lead in this run that doesn't already have drafts.",
              `The qualified leads are: ${JSON.stringify(qualifiedLeads)}.`,
              "1. For each entry above, call get_company_context with its company_id to review evidence.",
              "2. Call save_outreach_draft right now, in this turn, using that entry's lead_id (NOT its company_id — save_outreach_draft's lead_id parameter is the lead identifier, a different id from the company), for email steps 1, 2, and 3, and once for a LinkedIn message, grounding every personalization claim in a recorded source_id. Do not write the drafts out as text first and do not ask for confirmation — save_outreach_draft is reviewed by a human afterward, so there is no risk in calling it immediately. A description of a save_outreach_draft call is not a save_outreach_draft call.",
            ].join("\n"),
            maxTurns: MAX_TURNS_OUTREACH,
            maxBudgetUsd: MAX_BUDGET_OUTREACH_USD,
          },
        );
        assertAgentTurnSucceeded(outreachResult, "outreach generation");

        // Mirrors refineIcp's post-condition check below: a turn can end
        // with stop_reason "end_turn" and is_error=false purely by
        // narrating what it would draft instead of calling
        // save_outreach_draft (confirmed live — see the ICP-refinement
        // fix's comment in the system prompt). assertAgentTurnSucceeded
        // alone can't catch that, so verify the drafts actually landed.
        const drafts = await this.outreach.listForRun(runId);
        if (drafts.length === 0) {
          throw new Error("Agent did not produce any outreach drafts.");
        }
      }

      await this.runs.transitionStatus(
        runId,
        "generating_outreach",
        "awaiting_review",
      );
      await this.events.record({
        runId,
        eventType: "run_completed",
        message: "Research complete. Ready for review.",
      });
    } catch (err) {
      const current = await this.runs
        .getOwnedRun(runId, userId)
        .catch(() => null);
      if (
        current &&
        (current.status === "researching" ||
          current.status === "generating_outreach")
      ) {
        await this.fail(
          runId,
          current.status,
          errorMessage(err, "Run failed during research."),
        );
      }
    }
  }

  private async fail(
    runId: string,
    from: Parameters<RunRepository["transitionStatus"]>[1],
    message: string,
  ) {
    await this.runs.transitionStatus(runId, from, "failed", {
      error_message: message,
      completed_at: new Date().toISOString(),
    });
    await this.events.record({ runId, eventType: "run_failed", message });
  }
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}
