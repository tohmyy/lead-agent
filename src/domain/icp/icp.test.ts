import { describe, expect, it } from "vitest";

import { icpCriteriaSchema, saveIcpInputSchema } from "./icp";

describe("icpCriteriaSchema", () => {
  it("accepts a fully populated ICP", () => {
    const result = icpCriteriaSchema.safeParse({
      geography: { include: ["United States"] },
      industry: { include: ["B2B SaaS"] },
      employee_range: { min: 10, max: 100 },
      business_model: { include: ["B2B"] },
      target_personas: ["Founder"],
      hard_filters: ["US-based", "B2B SaaS"],
      soft_signals: ["Actively hiring"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts hard_filters/soft_signals as the only required fields (data-model.md section 9)", () => {
    const result = icpCriteriaSchema.safeParse({
      hard_filters: ["B2B SaaS"],
      soft_signals: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty hard_filters array", () => {
    const result = icpCriteriaSchema.safeParse({
      hard_filters: [],
      soft_signals: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing hard_filters field", () => {
    const result = icpCriteriaSchema.safeParse({ soft_signals: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a missing soft_signals field", () => {
    const result = icpCriteriaSchema.safeParse({ hard_filters: ["B2B SaaS"] });
    expect(result.success).toBe(false);
  });
});

describe("saveIcpInputSchema", () => {
  it("accepts criteria plus non-empty reasoning", () => {
    const result = saveIcpInputSchema.safeParse({
      criteria: { hard_filters: ["B2B SaaS"], soft_signals: [] },
      reasoning: "The objective specifies a B2B SaaS company.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty reasoning", () => {
    const result = saveIcpInputSchema.safeParse({
      criteria: { hard_filters: ["B2B SaaS"], soft_signals: [] },
      reasoning: "",
    });
    expect(result.success).toBe(false);
  });
});
