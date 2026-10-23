import { describe, expect, it } from "vitest";

import type {
  LeadSourceRow,
  RunEventRow,
  RunEventType,
  RunRow,
  RunStatus,
} from "@/infrastructure/supabase/types";
import {
  computeRunProgress,
  currentActivity,
  deriveStage,
  hasQualityIssueMention,
  researchedCount,
} from "./run-progress";

const baseRun: RunRow = {
  id: "run-1",
  user_id: "user-1",
  objective: "Find B2B SaaS companies",
  status: "researching",
  qualified_target: 10,
  discovery_limit: 30,
  discovered_count: 5,
  qualified_count: 2,
  rejected_count: 1,
  discovery_cost_usd: 0,
  agent_cost_usd: 0,
  started_at: null,
  completed_at: null,
  error_message: null,
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
};

function event(
  eventType: RunEventType,
  message = "event",
  id = "evt",
): RunEventRow {
  return {
    id,
    run_id: baseRun.id,
    event_type: eventType,
    message,
    metadata: null,
    created_at: "2024-01-01T00:00:00.000Z",
  };
}

function source(id: string): LeadSourceRow {
  return {
    id,
    discovered_company_id: "company",
    run_id: baseRun.id,
    url: "https://example.com",
    normalized_url: "https://example.com",
    title: null,
    source_type: "homepage",
    summary: "summary",
    relevant_excerpt: null,
    scraped_at: "2024-01-01T00:00:00.000Z",
    provider: "firecrawl",
    metadata: null,
    created_at: "2024-01-01T00:00:00.000Z",
  };
}

describe("deriveStage", () => {
  it("maps draft to understanding_request regardless of the latest event", () => {
    expect(deriveStage("draft", null)).toBe("understanding_request");
    expect(deriveStage("draft", "run_created")).toBe("understanding_request");
  });

  it("maps awaiting_icp_approval to waiting_icp_approval", () => {
    expect(deriveStage("awaiting_icp_approval", "icp_refined")).toBe(
      "waiting_icp_approval",
    );
  });

  it("treats researching with no research-stage event yet as finding_companies", () => {
    expect(deriveStage("researching", null)).toBe("finding_companies");
    expect(deriveStage("researching", "discovery_started")).toBe(
      "finding_companies",
    );
    expect(deriveStage("researching", "discovery_completed")).toBe(
      "finding_companies",
    );
  });

  it("treats researching with a research-stage event as researching_companies", () => {
    expect(deriveStage("researching", "company_research_started")).toBe(
      "researching_companies",
    );
    expect(deriveStage("researching", "company_research_completed")).toBe(
      "researching_companies",
    );
    expect(deriveStage("researching", "company_research_failed")).toBe(
      "researching_companies",
    );
    expect(deriveStage("researching", "lead_qualified")).toBe(
      "researching_companies",
    );
    expect(deriveStage("researching", "lead_rejected")).toBe(
      "researching_companies",
    );
  });

  it("maps generating_outreach to writing_outreach", () => {
    expect(deriveStage("generating_outreach", "outreach_started")).toBe(
      "writing_outreach",
    );
  });

  it("maps awaiting_review and completed to ready_for_review", () => {
    expect(deriveStage("awaiting_review", "run_completed")).toBe(
      "ready_for_review",
    );
    expect(deriveStage("completed", "run_completed")).toBe(
      "ready_for_review",
    );
  });

  it("maps failed and cancelled directly, regardless of the latest event", () => {
    expect(deriveStage("failed", "run_failed")).toBe("failed");
    expect(deriveStage("failed", null)).toBe("failed");
    expect(deriveStage("cancelled", "run_cancelled")).toBe("cancelled");
    expect(deriveStage("cancelled", null)).toBe("cancelled");
  });
});

describe("researchedCount", () => {
  it("returns 0 for an empty map", () => {
    expect(researchedCount({})).toBe(0);
  });

  it("does not count a company with zero sources", () => {
    expect(researchedCount({ "company-1": [] })).toBe(0);
  });

  it("counts only companies with at least one source", () => {
    expect(
      researchedCount({
        "company-1": [],
        "company-2": [source("s1")],
        "company-3": [source("s2"), source("s3")],
      }),
    ).toBe(2);
  });
});

describe("currentActivity", () => {
  it("returns the latest event's message for an active run", () => {
    const events = [event("discovery_started", "Discovery started")];
    expect(
      currentActivity({ status: "researching" as RunStatus }, events),
    ).toBe("Discovery started");
  });

  it("returns null for an active run with zero events", () => {
    expect(
      currentActivity({ status: "researching" as RunStatus }, []),
    ).toBeNull();
  });

  it("returns null for a terminal run even with events", () => {
    const events = [event("run_completed", "Research complete.")];
    expect(
      currentActivity({ status: "completed" as RunStatus }, events),
    ).toBeNull();
    expect(
      currentActivity({ status: "failed" as RunStatus }, events),
    ).toBeNull();
  });
});

describe("hasQualityIssueMention", () => {
  it("is false for a plain completion message", () => {
    expect(
      hasQualityIssueMention("Research complete. Ready for review."),
    ).toBe(false);
  });

  it("is true when the message mentions a quality check", () => {
    expect(
      hasQualityIssueMention(
        "Research complete. Ready for review. Quality check found 2 issue(s): thin evidence.",
      ),
    ).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(hasQualityIssueMention("QUALITY CHECK FOUND AN ISSUE")).toBe(true);
  });
});

describe("computeRunProgress banners", () => {
  it("sets the failed banner from error_message and excludes targetShortfall", () => {
    const run: RunRow = { ...baseRun, status: "failed", error_message: "boom" };
    const progress = computeRunProgress({ run, events: [], sourcesByCompany: {} });
    expect(progress.banners.failed).toEqual({ message: "boom" });
    expect(progress.banners.targetShortfall).toBe(false);
  });

  it("flags target shortfall once the run has left research and is short", () => {
    const run: RunRow = {
      ...baseRun,
      status: "awaiting_review",
      qualified_count: 3,
      qualified_target: 10,
    };
    const progress = computeRunProgress({ run, events: [], sourcesByCompany: {} });
    expect(progress.banners.targetShortfall).toBe(true);
  });

  it("does not flag target shortfall while still researching", () => {
    const run: RunRow = {
      ...baseRun,
      status: "researching",
      qualified_count: 3,
      qualified_target: 10,
    };
    const progress = computeRunProgress({ run, events: [], sourcesByCompany: {} });
    expect(progress.banners.targetShortfall).toBe(false);
  });

  it("flags the discovery cap independent of stage", () => {
    const run: RunRow = {
      ...baseRun,
      status: "researching",
      discovered_count: 30,
      discovery_limit: 30,
      qualified_count: 3,
      qualified_target: 10,
    };
    const progress = computeRunProgress({ run, events: [], sourcesByCompany: {} });
    expect(progress.banners.discoveryCapReached).toBe(true);
  });

  it("does not flag the discovery cap once the qualified target is already met", () => {
    const run: RunRow = {
      ...baseRun,
      discovered_count: 30,
      discovery_limit: 30,
      qualified_count: 10,
      qualified_target: 10,
    };
    const progress = computeRunProgress({ run, events: [], sourcesByCompany: {} });
    expect(progress.banners.discoveryCapReached).toBe(false);
  });

  it("surfaces the run_completed message verbatim when it mentions a quality issue", () => {
    const message =
      "Research complete. Ready for review. Quality check found 1 issue(s): thin evidence.";
    const run: RunRow = { ...baseRun, status: "awaiting_review" };
    const progress = computeRunProgress({
      run,
      events: [event("run_completed", message)],
      sourcesByCompany: {},
    });
    expect(progress.banners.qualityIssueMessage).toBe(message);
  });

  it("has no quality-issue banner when there is no run_completed event", () => {
    const run: RunRow = { ...baseRun, status: "awaiting_review" };
    const progress = computeRunProgress({ run, events: [], sourcesByCompany: {} });
    expect(progress.banners.qualityIssueMessage).toBeNull();
  });
});
