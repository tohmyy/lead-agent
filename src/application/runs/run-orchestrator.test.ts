import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocked entirely rather than partially (unlike agent-runtime.test.ts's
// SDK mock) — this test isn't exercising the real agent runtime at all,
// just RunOrchestrator's own deterministic control-flow logic around it.
vi.mock("@/agents/agent-runtime", () => ({
  runAgentTurn: vi.fn(),
  assertAgentTurnSucceeded: (result: { isError: boolean }, context: string) => {
    if (result.isError) throw new Error(`Agent turn (${context}) failed`);
  },
}));

import { runAgentTurn } from "@/agents/agent-runtime";
import type {
  LeadRow,
  OutreachDraftRow,
  RunRow,
} from "@/infrastructure/supabase/types";
import { RunOrchestrator } from "./run-orchestrator";

const SUCCESS_RESULT = {
  isError: false,
  stopReason: "end_turn",
  totalCostUsd: 0.01,
  numTurns: 3,
};

function makeRun(overrides: Partial<RunRow> = {}): RunRow {
  return {
    id: "run-1",
    user_id: "user-1",
    objective: "Find B2B SaaS companies",
    status: "draft",
    qualified_target: 1,
    discovery_limit: 2,
    discovered_count: 0,
    qualified_count: 0,
    rejected_count: 0,
    error_message: null,
    started_at: null,
    completed_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as RunRow;
}

function makeLead(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    id: "lead-1",
    run_id: "run-1",
    discovered_company_id: "company-1",
    company_name: "Acme Inc.",
    domain: "acme.com",
    qualification_status: "qualified",
    confidence_score: 85,
    fit_reasons: [],
    concerns: [],
    qualification_reasoning: "Matches ICP.",
    source_summary: "summary",
    research_metadata: null,
    review_state: "not_reviewed",
    qualified_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as LeadRow;
}

function makeDraft(overrides: Partial<OutreachDraftRow>): OutreachDraftRow {
  return {
    id: `draft-${Math.random()}`,
    lead_id: "lead-1",
    run_id: "run-1",
    channel: "email",
    step: 1,
    subject: "Subject",
    body: "Body",
    personalization_context: { claims: [] },
    review_state: "not_reviewed",
    version: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as OutreachDraftRow;
}

function buildOrchestrator(opts: {
  run: RunRow;
  leads?: LeadRow[];
  drafts?: OutreachDraftRow[];
}) {
  const transitionStatus = vi.fn().mockResolvedValue(undefined);
  const runsRepo = {
    getOwnedRun: vi.fn().mockResolvedValue(opts.run),
    transitionStatus,
    addCost: vi.fn().mockResolvedValue(undefined),
  };
  const eventsRecord = vi.fn().mockResolvedValue(undefined);
  const eventsRepo = { record: eventsRecord };
  const leadsRepo = {
    listForRun: vi.fn().mockResolvedValue(opts.leads ?? []),
  };
  const sourcesRepo = {
    listForCompany: vi.fn().mockResolvedValue([{ id: "source-1" }]),
  };
  const drafts = opts.drafts ?? [];
  const outreachRepo = {
    listForRun: vi.fn().mockResolvedValue(drafts),
    listForLead: vi
      .fn()
      .mockImplementation((leadId: string) =>
        Promise.resolve(drafts.filter((d) => d.lead_id === leadId)),
      ),
  };
  const icpsService = { getLatest: vi.fn().mockResolvedValue({ id: "icp-1" }) };

  const orchestrator = new RunOrchestrator(
    runsRepo as never,
    icpsService as never,
    eventsRepo as never,
    outreachRepo as never,
    leadsRepo as never,
    sourcesRepo as never,
  );

  return { orchestrator, runsRepo, eventsRecord };
}

function completedMessage(eventsRecord: ReturnType<typeof vi.fn>): string {
  const call = eventsRecord.mock.calls.find(
    (args: unknown[]) =>
      (args[0] as { eventType: string }).eventType === "run_completed",
  );
  return (call?.[0] as { message: string } | undefined)?.message as string;
}

describe("RunOrchestrator.refineIcp", () => {
  beforeEach(() => {
    vi.mocked(runAgentTurn).mockResolvedValue(SUCCESS_RESULT);
  });

  it("transitions draft -> awaiting_icp_approval for a brand-new run", async () => {
    const { orchestrator, runsRepo } = buildOrchestrator({
      run: makeRun({ status: "draft" }),
    });

    await orchestrator.refineIcp("run-1", "user-1");

    expect(runsRepo.transitionStatus).toHaveBeenCalledWith(
      "run-1",
      "draft",
      "awaiting_icp_approval",
    );
  });

  it("skips transitionStatus when Regenerate runs on an already-awaiting-approval run (Phase 10 fix)", async () => {
    const { orchestrator, runsRepo } = buildOrchestrator({
      run: makeRun({ status: "awaiting_icp_approval" }),
    });

    await orchestrator.refineIcp("run-1", "user-1");

    expect(runsRepo.transitionStatus).not.toHaveBeenCalled();
  });
});

describe("RunOrchestrator.runResearchAndOutreach", () => {
  beforeEach(() => {
    vi.mocked(runAgentTurn).mockResolvedValue(SUCCESS_RESULT);
  });

  it("flags a qualified lead missing an email step in the outreach-shape check", async () => {
    const lead = makeLead({ id: "lead-1", qualification_status: "qualified" });
    const drafts = [
      makeDraft({ lead_id: lead.id, channel: "email", step: 1 }),
      makeDraft({ lead_id: lead.id, channel: "email", step: 2 }),
      // step 3 deliberately missing
      makeDraft({
        lead_id: lead.id,
        channel: "linkedin",
        step: null,
        subject: null,
      }),
    ];
    const run = makeRun({
      status: "researching",
      qualified_count: 1,
      qualified_target: 1,
      discovered_count: 2,
      discovery_limit: 2,
    });
    const { orchestrator, eventsRecord } = buildOrchestrator({
      run,
      leads: [lead],
      drafts,
    });

    await orchestrator.runResearchAndOutreach(run.id, run.user_id);

    expect(completedMessage(eventsRecord)).toContain(
      "missing email step(s) 3",
    );
  });

  it("flags a run that stopped short of target while discovery budget remained (Phase 13 fix)", async () => {
    const lead = makeLead({ id: "lead-1", qualification_status: "qualified" });
    const drafts = [
      makeDraft({ lead_id: lead.id, channel: "email", step: 1 }),
      makeDraft({ lead_id: lead.id, channel: "email", step: 2 }),
      makeDraft({ lead_id: lead.id, channel: "email", step: 3 }),
      makeDraft({
        lead_id: lead.id,
        channel: "linkedin",
        step: null,
        subject: null,
      }),
    ];
    const run = makeRun({
      status: "researching",
      qualified_count: 1,
      qualified_target: 10,
      discovered_count: 5,
      discovery_limit: 20,
    });
    const { orchestrator, eventsRecord } = buildOrchestrator({
      run,
      leads: [lead],
      drafts,
    });

    await orchestrator.runResearchAndOutreach(run.id, run.user_id);

    expect(completedMessage(eventsRecord)).toContain(
      "Run stopped with 1/10 qualified leads while discovery budget remained (5/20 companies discovered)",
    );
  });

  it("does not flag a run that legitimately reached its target", async () => {
    const lead = makeLead({ id: "lead-1", qualification_status: "qualified" });
    const drafts = [
      makeDraft({ lead_id: lead.id, channel: "email", step: 1 }),
      makeDraft({ lead_id: lead.id, channel: "email", step: 2 }),
      makeDraft({ lead_id: lead.id, channel: "email", step: 3 }),
      makeDraft({
        lead_id: lead.id,
        channel: "linkedin",
        step: null,
        subject: null,
      }),
    ];
    const run = makeRun({
      status: "researching",
      qualified_count: 1,
      qualified_target: 1,
      discovered_count: 2,
      discovery_limit: 2,
    });
    const { orchestrator, eventsRecord } = buildOrchestrator({
      run,
      leads: [lead],
      drafts,
    });

    await orchestrator.runResearchAndOutreach(run.id, run.user_id);

    expect(completedMessage(eventsRecord)).toBe(
      "Research complete. Ready for review.",
    );
  });

  it("does not flag a run that exhausted its discovery budget even though target wasn't reached", async () => {
    const run = makeRun({
      status: "researching",
      qualified_count: 0,
      qualified_target: 5,
      discovered_count: 2,
      discovery_limit: 2,
    });
    const { orchestrator, eventsRecord } = buildOrchestrator({
      run,
      leads: [],
      drafts: [],
    });

    await orchestrator.runResearchAndOutreach(run.id, run.user_id);

    expect(completedMessage(eventsRecord)).toBe(
      "Research complete. Ready for review.",
    );
  });
});
