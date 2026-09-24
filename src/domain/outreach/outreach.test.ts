import { describe, expect, it } from "vitest";

import { AppError } from "@/domain/shared/errors";
import {
  assertClaimsReferenceKnownSources,
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
