import { describe, expect, it, vi } from "vitest";

import type { LeadRow, RunIcpRow, RunRow } from "@/infrastructure/supabase/types";
import { QualificationService } from "./qualification-service";

function makeRun(): RunRow {
  return {
    id: "run-1",
    user_id: "user-1",
    objective: "Find companies",
    status: "researching",
    qualified_target: 6,
    discovery_limit: 20,
    discovered_count: 1,
    qualified_count: 0,
    rejected_count: 1,
    discovery_cost_usd: 0,
    agent_cost_usd: 0,
    started_at: null,
    completed_at: null,
    error_message: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

const existingLead = {
  id: "lead-1",
  qualification_status: "not_qualified",
} as LeadRow;

describe("QualificationService.saveLead counters", () => {
  it("does not increment rejected_count again on a duplicate not_qualified save", async () => {
    const incrementCounts = vi.fn();
    const service = new QualificationService(
      {
        getOwned: vi.fn().mockResolvedValue({
          company_name: "Acme",
          domain: "acme.com",
        }),
      } as never,
      { listForCompany: vi.fn().mockResolvedValue([]) } as never,
      {
        getByCompany: vi.fn().mockResolvedValue(existingLead),
        upsert: vi.fn().mockResolvedValue({ lead: existingLead, wasNew: false }),
      } as never,
      {
        getApproved: vi.fn().mockResolvedValue({
          criteria: {
            hard_filters: ["US-based"],
            soft_signals: [],
          },
        } as unknown as RunIcpRow),
      } as never,
      { record: vi.fn() } as never,
      { incrementCounts } as never,
    );

    await service.saveLead(makeRun(), {
      company_id: "11111111-1111-4111-8111-111111111111",
      qualification_status: "not_qualified",
      fit_reasons: [],
      concerns: [],
      hard_filter_results: [{ filter: "US-based", result: "fail" }],
      qualification_reasoning: "Failed geography.",
      source_summary: "Discovery metadata.",
    });

    expect(incrementCounts).not.toHaveBeenCalled();
  });
});
