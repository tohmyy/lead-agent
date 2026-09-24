import { describe, expect, it } from "vitest";

import { sanitizeForLog } from "./sanitize";

describe("sanitizeForLog", () => {
  it("redacts keys that look like secrets, anywhere in the object (data-model.md section 27 / AGENTS.md #22)", () => {
    const result = sanitizeForLog({
      apiKey: "sk-test-secret",
      nested: { authorization: "Bearer abc", token: "xyz" },
      password: "hunter2",
      serviceRoleKey: "sk-service-role",
    }) as Record<string, unknown>;

    expect(result.apiKey).toBe("[redacted]");
    expect(result.password).toBe("[redacted]");
    expect(result.serviceRoleKey).toBe("[redacted]");
    expect((result.nested as Record<string, unknown>).authorization).toBe(
      "[redacted]",
    );
    expect((result.nested as Record<string, unknown>).token).toBe("[redacted]");
  });

  it("leaves ordinary fields untouched", () => {
    const result = sanitizeForLog({ company_name: "Acme", count: 5 }) as Record<
      string,
      unknown
    >;
    expect(result.company_name).toBe("Acme");
    expect(result.count).toBe(5);
  });

  it("truncates very long strings so logs stay small", () => {
    const long = "a".repeat(5000);
    const result = sanitizeForLog({ text: long }) as Record<string, unknown>;
    expect((result.text as string).length).toBeLessThan(2100);
  });
});
