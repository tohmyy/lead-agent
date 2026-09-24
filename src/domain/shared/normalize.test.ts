import { describe, expect, it } from "vitest";

import { AppError } from "./errors";
import {
  normalizeCompanyName,
  normalizeDomain,
  normalizeUrl,
  parseUrlStrict,
} from "./normalize";

describe("normalizeDomain", () => {
  it.each([
    ["https://www.acme.com/", "acme.com"],
    ["http://acme.com", "acme.com"],
    ["WWW.Acme.com", "acme.com"],
    ["acme.com/pricing", "acme.com"],
    ["acme.com:8080", "acme.com"],
  ])("normalizes %s to %s (data-model.md section 42)", (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });

  it("collapses variants to the same value so duplicate discovery is detected (data-model.md section 14)", () => {
    const variants = ["https://www.acme.com/", "acme.com", "http://acme.com/"];
    const normalized = new Set(variants.map(normalizeDomain));
    expect(normalized.size).toBe(1);
  });
});

describe("normalizeCompanyName", () => {
  it.each([
    ["  Acme   Inc  ", "Acme Inc"],
    ["Acme\tInc", "Acme Inc"],
    ["Acme Inc", "Acme Inc"],
  ])(
    "normalizes %s to %s (data-model.md section 17)",
    (input, expected) => {
      expect(normalizeCompanyName(input)).toBe(expected);
    },
  );
});

describe("normalizeUrl", () => {
  it("keeps distinct paths distinct", () => {
    expect(normalizeUrl("https://acme.com/pricing")).not.toBe(
      normalizeUrl("https://acme.com/about"),
    );
  });

  it("treats www and trailing slash as equivalent", () => {
    expect(normalizeUrl("https://www.acme.com/pricing/")).toBe(
      normalizeUrl("https://acme.com/pricing"),
    );
  });
});

describe("parseUrlStrict", () => {
  it("rejects non-http(s) schemes (TOOLS-CONTRACT.md section 20)", () => {
    expect(() => parseUrlStrict("ftp://acme.com")).toThrow(AppError);
    expect(() => parseUrlStrict("javascript:alert(1)")).toThrow(AppError);
  });

  it("rejects malformed URLs", () => {
    expect(() => parseUrlStrict("not a url")).toThrow(AppError);
  });

  it("accepts http and https", () => {
    expect(() => parseUrlStrict("http://acme.com")).not.toThrow();
    expect(() => parseUrlStrict("https://acme.com")).not.toThrow();
  });
});
