import { describe, expect, it } from "vitest";

import { AppError } from "@/domain/shared/errors";
import type { OutreachDraftRow } from "@/infrastructure/supabase/types";
import {
  assertClaimsReferenceKnownSources,
  draftsForExport,
  latestOutreachDrafts,
  leadsForExport,
  saveOutreachDraftInputSchema,
} from "./outreach";

describe("saveOutreachDraftInputSchema", () => {
  // Valid v4-shaped UUIDs — zod's .uuid() validates the version/variant
  // nibbles, so ad hoc "1111..." style fixtures fail parsing.
  const sourceId = "123e4567-e89b-42d3-a456-426614174000";
  const leadId = "223e4567-e89b-42d3-a456-426614174000";

  it("accepts a valid email draft (step + subject required)", () => {
    const result = saveOutreachDraftInputSchema.safeParse({
      lead_id: leadId,
      channel: "email",
      step: 1,
      subject: "Quick question",
      body: "Hi there",
      personalization_context: {
        claims: [{ text: "fact", source_id: sourceId }],
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid LinkedIn draft (no step, no subject)", () => {
    const result = saveOutreachDraftInputSchema.safeParse({
      lead_id: leadId,
      channel: "linkedin",
      body: "Hi there",
      personalization_context: { claims: [] },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an email draft missing subject (TOOLS-CONTRACT.md section 32)", () => {
    const result = saveOutreachDraftInputSchema.safeParse({
      lead_id: leadId,
      channel: "email",
      step: 1,
      body: "Hi there",
      personalization_context: { claims: [] },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an arbitrary step number", () => {
    const result = saveOutreachDraftInputSchema.safeParse({
      lead_id: leadId,
      channel: "email",
      step: 7,
      subject: "Hi",
      body: "Hi there",
      personalization_context: { claims: [] },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a LinkedIn draft that includes a step", () => {
    const result = saveOutreachDraftInputSchema.safeParse({
      lead_id: leadId,
      channel: "linkedin",
      step: 1,
      body: "Hi there",
      personalization_context: { claims: [] },
    });
    expect(result.success).toBe(false);
  });
});

describe("assertClaimsReferenceKnownSources", () => {
  const knownSourceIds = new Set(["source-a", "source-b"]);

  it("allows claims that cite a known source", () => {
    expect(() =>
      assertClaimsReferenceKnownSources(
        [{ source_id: "source-a" }],
        knownSourceIds,
      ),
    ).not.toThrow();
  });

  it("blocks a claim citing an unrecorded source (UI-SPEC.md section 24 / AGENTS.md #35)", () => {
    expect(() =>
      assertClaimsReferenceKnownSources(
        [{ source_id: "made-up" }],
        knownSourceIds,
      ),
    ).toThrow(AppError);
  });
});

describe("latestOutreachDrafts", () => {
  function draft(
    overrides: Partial<OutreachDraftRow> & Pick<OutreachDraftRow, "version">,
  ): OutreachDraftRow {
    return {
      id: `id-${Math.random()}`,
      lead_id: "lead-1",
      run_id: "run-1",
      channel: "email",
      step: 1,
      subject: "Subject",
      body: "Body",
      personalization_context: { claims: [] },
      review_state: "not_reviewed",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      ...overrides,
    };
  }

  it("keeps only the highest version per (channel, step)", () => {
    const drafts = [
      draft({ id: "e1-v1", channel: "email", step: 1, version: 1 }),
      draft({ id: "e1-v2", channel: "email", step: 1, version: 2 }),
      draft({ id: "e2-v1", channel: "email", step: 2, version: 1 }),
      draft({
        id: "li-v1",
        channel: "linkedin",
        step: null,
        subject: null,
        version: 1,
      }),
    ];

    const result = latestOutreachDrafts(drafts);

    expect(result).toHaveLength(3);
    expect(result.find((d) => d.channel === "email" && d.step === 1)?.id).toBe(
      "e1-v2",
    );
    expect(result.find((d) => d.channel === "email" && d.step === 2)?.id).toBe(
      "e2-v1",
    );
    expect(result.find((d) => d.channel === "linkedin")?.id).toBe("li-v1");
  });

  it("does not confuse LinkedIn drafts with email drafts that have no step", () => {
    const drafts = [
      draft({
        id: "li-v1",
        channel: "linkedin",
        step: null,
        subject: null,
        version: 1,
      }),
      draft({ id: "e1-v1", channel: "email", step: 1, version: 1 }),
    ];
    expect(latestOutreachDrafts(drafts)).toHaveLength(2);
  });
});

describe("export scope", () => {
  function draft(
    overrides: Partial<OutreachDraftRow> &
      Pick<OutreachDraftRow, "id" | "review_state" | "version">,
  ): OutreachDraftRow {
    return {
      lead_id: "lead-1",
      run_id: "run-1",
      channel: "email",
      step: 1,
      subject: "Subject",
      body: "Body",
      personalization_context: { claims: [] },
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      ...overrides,
    };
  }

  const leads = [
    { id: "lead-1", qualification_status: "qualified" },
    { id: "lead-2", qualification_status: "qualified" },
    { id: "lead-3", qualification_status: "not_qualified" },
  ];

  const drafts = [
    draft({
      id: "approved",
      lead_id: "lead-1",
      review_state: "approved_for_export",
      version: 1,
    }),
    draft({
      id: "unapproved",
      lead_id: "lead-2",
      review_state: "not_reviewed",
      version: 1,
    }),
  ];

  it("defaults to drafts approved for export", () => {
    expect(draftsForExport(drafts, "approved").map((item) => item.id)).toEqual([
      "approved",
    ]);
    expect(
      leadsForExport(leads, drafts, "approved").map((lead) => lead.id),
    ).toEqual(["lead-1"]);
  });

  it("includes every qualified lead when scope is all", () => {
    expect(leadsForExport(leads, drafts, "all").map((lead) => lead.id)).toEqual(
      ["lead-1", "lead-2"],
    );
    expect(draftsForExport(drafts, "all")).toHaveLength(2);
  });
});
