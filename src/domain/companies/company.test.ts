import { describe, expect, it } from "vitest";

import { recordSourceInputSchema, SOURCE_TYPES } from "./company";

describe("recordSourceInputSchema", () => {
  const companyId = "123e4567-e89b-42d3-a456-426614174000";

  it("accepts a valid source record", () => {
    const result = recordSourceInputSchema.safeParse({
      company_id: companyId,
      url: "https://acme.com/pricing",
      title: "Pricing",
      source_type: "pricing",
      summary: "Acme's pricing page describes three subscription tiers.",
      relevant_excerpt: "Starter, Growth, Enterprise plans.",
      provider: "firecrawl",
    });
    expect(result.success).toBe(true);
  });

  it("accepts the minimal required fields (title/excerpt/provider optional)", () => {
    const result = recordSourceInputSchema.safeParse({
      company_id: companyId,
      url: "https://acme.com",
      source_type: "homepage",
      summary: "Acme's homepage.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID company_id", () => {
    const result = recordSourceInputSchema.safeParse({
      company_id: "not-a-uuid",
      url: "https://acme.com",
      source_type: "homepage",
      summary: "Acme's homepage.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid URL", () => {
    const result = recordSourceInputSchema.safeParse({
      company_id: companyId,
      url: "not a url",
      source_type: "homepage",
      summary: "Acme's homepage.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a source_type outside the canonical list", () => {
    const result = recordSourceInputSchema.safeParse({
      company_id: companyId,
      url: "https://acme.com",
      source_type: "press-release",
      summary: "Acme's homepage.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty summary", () => {
    const result = recordSourceInputSchema.safeParse({
      company_id: companyId,
      url: "https://acme.com",
      source_type: "homepage",
      summary: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts every canonical source type (data-model.md section 8/section 25)", () => {
    for (const sourceType of SOURCE_TYPES) {
      const result = recordSourceInputSchema.safeParse({
        company_id: companyId,
        url: "https://acme.com",
        source_type: sourceType,
        summary: "Evidence summary.",
      });
      expect(result.success).toBe(true);
    }
  });
});
