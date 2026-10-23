import { describe, expect, it } from "vitest";

import { AppError } from "./errors";
import {
  companyNameKey,
  isProfileHost,
  isResearchableDomain,
  normalizeCompanyName,
  normalizeDomain,
  normalizeUrl,
  parseUrlStrict,
  unresolvedDomainForName,
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

describe("isProfileHost / isResearchableDomain", () => {
  it("treats LinkedIn and other social hosts as not company websites", () => {
    expect(isProfileHost("https://www.linkedin.com/company/dusk-mobile")).toBe(
      true,
    );
    expect(isProfileHost("linkedin.com")).toBe(true);
    expect(isResearchableDomain("https://linkedin.com/company/dusk-mobile")).toBe(
      false,
    );
    expect(isResearchableDomain("dusk-mobile.com")).toBe(true);
  });

  it("does not treat a LinkedIn profile host as the same domain as the company site", () => {
    expect(normalizeDomain("https://linkedin.com/company/dusk-mobile")).toBe(
      "linkedin.com",
    );
    expect(normalizeDomain("https://dusk-mobile.com")).toBe("dusk-mobile.com");
  });
});

describe("companyNameKey", () => {
  it("collapses legal suffixes and punctuation so the same company matches", () => {
    expect(companyNameKey("Dusk Mobile Inc.")).toBe(companyNameKey("Dusk Mobile"));
    expect(companyNameKey("Streamline Factory, LLC")).toBe(
      companyNameKey("Streamline Factory"),
    );
  });
});

describe("unresolvedDomainForName", () => {
  it("is not researchable", () => {
    const sentinel = unresolvedDomainForName("Dusk Mobile");
    expect(isResearchableDomain(sentinel)).toBe(false);
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
