import "server-only";

import { assertAgentTurnSucceeded, runAgentTurn } from "@/agents/agent-runtime";
import { payableCost } from "@/domain/runs/spend";
import { IcpService } from "@/application/icp/icp-service";
import { NotificationService } from "@/application/notifications/notification-service";
import { latestOutreachDrafts } from "@/domain/outreach/outreach";
import { LeadRepository } from "@/infrastructure/supabase/repositories/lead-repository";
import { OutreachRepository } from "@/infrastructure/supabase/repositories/outreach-repository";
import { RunEventRepository } from "@/infrastructure/supabase/repositories/run-event-repository";
import { RunRepository } from "@/infrastructure/supabase/repositories/run-repository";
import { SourceRepository } from "@/infrastructure/supabase/repositories/source-repository";
import { log } from "@/lib/logging/logger";
import type { RunRow } from "@/infrastructure/supabase/types";

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
    private readonly sources = new SourceRepository(),
    private readonly notifications = new NotificationService(),
  ) {}

  /**
   * Stage 1: objective -> draft ICP. Called right after run creation, and
   * again by "Regenerate" on an already-`awaiting_icp_approval` run — that
   * second case is a same-state action (draft another version while still
   * awaiting approval), not a real transition, so it must skip
   * transitionStatus entirely rather than attempt a self-loop
   * `awaiting_icp_approval -> awaiting_icp_approval`, which
   * assertValidTransition correctly rejects (ALLOWED_TRANSITIONS has no
   * self-loops) and which the catch block below would otherwise turn into
   * failing the whole run.
   */
  async refineIcp(runId: string, userId: string): Promise<void> {
    try {
      const run = await this.runs.getOwnedRun(runId, userId);
      if (run.status !== "awaiting_icp_approval") {
        await this.runs.transitionStatus(
          runId,
          run.status,
          "awaiting_icp_approval",
        );
      }

      const result = await runAgentTurn(
        { runId, userId },
        {
          task: [
            `Qualification objective: "${run.objective}"`,
            "Call save_icp right now, in this turn, with your refined criteria — hard_filters, soft_signals, and the other fields it accepts. Do not write out the ICP as text first and do not ask for confirmation; save_icp is reviewed by a human afterward, so there is no risk in calling it immediately.",
          ].join("\n"),
          maxTurns: MAX_TURNS_ICP,
          maxBudgetUsd: MAX_BUDGET_ICP_USD,
          skills: ["icp-refinement"],
        },
      );
      await this.recordAgentSpend(runId, result.totalCostUsd);
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
        await this.fail(current, errorMessage(err, "ICP refinement failed."));
      } else {
        log.warn(
          "[orchestrator] run already left expected state, skipping fail()",
          { runId, status: current?.status ?? "unknown (re-fetch failed)" },
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
            "3. For each company in `discovered` (not `prefiltered`): call get_company_context first. If it already has a qualification decision, skip it. Otherwise call research_website, record_source for evidence worth keeping, then save_lead. hard_filter_results must include one entry per approved hard filter, copying each filter string exactly, with result pass, fail, or unknown. Never mark a company qualified if any hard filter failed. Companies in `prefiltered` are already saved — do not research them.",
            "4. Keep discovering/researching/qualifying more candidates until qualified_count reaches qualified_target, or a tool returns DISCOVERY_LIMIT_EXCEEDED / TARGET_ALREADY_REACHED and there are no more already-discovered, unqualified companies left to research.",
            "5. Do not generate outreach in this turn — that happens separately.",
          ].join("\n"),
          maxTurns: MAX_TURNS_RESEARCH,
          maxBudgetUsd: MAX_BUDGET_RESEARCH_USD,
          skills: ["lead-qualification", "lead-list-quality"],
        },
      );
      await this.recordAgentSpend(runId, researchResult.totalCostUsd);
      assertAgentTurnSucceeded(researchResult, "research and qualification");

      const afterResearch = await this.runs.getOwnedRun(runId, userId);
      // BUILD-PLAN.md section 38's control loop only has two legitimate
      // stopping conditions: qualified_count reaches qualified_target, or
      // the discovery budget is exhausted. The research turn above is one
      // continuous agent conversation, not a deterministic loop this class
      // drives itself — so the agent could end its turn early
      // (stop_reason "end_turn", no error) with turns and discovery slots
      // still available. assertAgentTurnSucceeded only catches a literal
      // error; it can't catch a premature stop. Checked here rather than
      // trusted from the agent's own turn outcome.
      const underTarget =
        afterResearch.qualified_count < afterResearch.qualified_target &&
        afterResearch.discovered_count < afterResearch.discovery_limit;

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
            skills: ["outbound-copywriting", "lead-list-quality"],
          },
        );
        await this.recordAgentSpend(runId, outreachResult.totalCostUsd);
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

      const qualityIssues = await this.checkLeadListQuality(runId);
      const allIssues = underTarget
        ? [
            `Run stopped with ${afterResearch.qualified_count}/${afterResearch.qualified_target} qualified leads while discovery budget remained (${afterResearch.discovered_count}/${afterResearch.discovery_limit} companies discovered)`,
            ...qualityIssues,
          ]
        : qualityIssues;

      await this.runs.transitionStatus(
        runId,
        "generating_outreach",
        "awaiting_review",
      );
      await this.events.record({
        runId,
        eventType: "run_completed",
        message:
          allIssues.length > 0
            ? `Research complete. Ready for review. Quality check found ${allIssues.length} issue(s): ${allIssues.join("; ")}.`
            : "Research complete. Ready for review.",
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
        await this.fail(current, errorMessage(err, "Run failed during research."));
      } else {
        log.warn(
          "[orchestrator] run already left expected state, skipping fail()",
          { runId, status: current?.status ?? "unknown (re-fetch failed)" },
        );
      }
    }
  }

  /**
   * Deterministic check for the two lead-list-quality-guide.md checks
   * (BUILD-PLAN.md section 24, "Lead List Quality: maintain consistency and
   * evidence quality") that nothing else in the app already guarantees:
   * every qualified lead has recorded evidence, and every qualified lead
   * specifically (not just "the run as a whole", which the outreach turn's
   * own post-condition check above only verifies) has outreach drafts.
   * Deliberately doesn't block completion (section 40 "a single failed
   * company should not necessarily fail the entire run") — issues surface
   * in the human-readable activity feed for the reviewer instead.
   */
  private async checkLeadListQuality(runId: string): Promise<string[]> {
    const qualifiedLeads = (await this.leads.listForRun(runId)).filter(
      (lead) => lead.qualification_status === "qualified",
    );

    const issues: string[] = [];
    for (const lead of qualifiedLeads) {
      const [sources, drafts] = await Promise.all([
        this.sources.listForCompany(lead.discovered_company_id),
        this.outreach.listForLead(lead.id),
      ]);
      if (sources.length === 0) {
        issues.push(`${lead.company_name} has no recorded evidence sources`);
      }

      // The 3-email-steps + 1-LinkedIn shape (BUILD-PLAN.md section 33) is
      // only ever enforced by prompt instruction, not by anything the
      // agent's tool calls are forced to satisfy — verify it actually
      // happened rather than trusting the agent's own count. Dedupe first:
      // save_outreach_draft always inserts a new version rather than
      // updating in place, so raw drafts.length can overcount.
      const latestDrafts = latestOutreachDrafts(drafts);
      if (latestDrafts.length === 0) {
        issues.push(`${lead.company_name} has no outreach drafts`);
      } else {
        const emailSteps = new Set(
          latestDrafts.filter((d) => d.channel === "email").map((d) => d.step),
        );
        const missingSteps = ([1, 2, 3] as const).filter(
          (s) => !emailSteps.has(s),
        );
        if (missingSteps.length > 0) {
          issues.push(
            `${lead.company_name} is missing email step(s) ${missingSteps.join(", ")}`,
          );
        }
        const linkedinCount = latestDrafts.filter(
          (d) => d.channel === "linkedin",
        ).length;
        if (linkedinCount !== 1) {
          issues.push(
            `${lead.company_name} has ${linkedinCount} LinkedIn draft(s) (expected 1)`,
          );
        }
      }
    }
    return issues;
  }

  private async recordAgentSpend(runId: string, totalCostUsd: number) {
    const agentUsd = payableCost(totalCostUsd);
    if (agentUsd <= 0) return;
    await this.runs.addCost(runId, { discoveryUsd: 0, agentUsd });
  }

  private async fail(run: RunRow, message: string) {
    await this.runs.transitionStatus(run.id, run.status, "failed", {
      error_message: message,
      completed_at: new Date().toISOString(),
    });
    await this.events.record({ runId: run.id, eventType: "run_failed", message });

    try {
      await this.notifications.notifyRunFailed({
        runId: run.id,
        userId: run.user_id,
        objective: run.objective,
        message,
      });
    } catch (err) {
      // notifyRunFailed already guarantees it never throws; this catch is
      // pure defense-in-depth so a bug there can never prevent the failure
      // recording above (which has already completed by this point).
      log.error("[orchestrator:fail] notification side-effect failed", {
        runId: run.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}
