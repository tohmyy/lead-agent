import { describe, expect, it } from "vitest";

import {
  resolveIncomingIdentity,
  selectExistingCompany,
  shouldUpgradeUnresolvedDomain,
} from "./identity";

describe("resolveIncomingIdentity", () => {
  it("keeps a real company website", () => {
    const identity = resolveIncomingIdentity({
      companyName: "Dusk Mobile",
      domain: "https://dusk-mobile.com",
    });
    expect(identity.normalizedDomain).toBe("dusk-mobile.com");
    expect(identity.researchable).toBe(true);
  });

  it("does not use a LinkedIn profile as the company domain", () => {
    const identity = resolveIncomingIdentity({
      companyName: "Dusk Mobile",
      domain: "https://www.linkedin.com/company/dusk-mobile",
    });
    expect(identity.normalizedDomain).not.toBe("linkedin.com");
    expect(identity.researchable).toBe(false);
    expect(identity.normalizedDomain).toContain("unresolved.invalid");
  });

  it("does not collide a LinkedIn URL with the real website", () => {
    const fromLinkedIn = resolveIncomingIdentity({
      companyName: "Dusk Mobile",
      domain: "https://linkedin.com/company/dusk-mobile",
    });
    const fromSite = resolveIncomingIdentity({
      companyName: "Dusk Mobile",
      domain: "https://dusk-mobile.com",
    });
    expect(fromLinkedIn.normalizedDomain).not.toBe(fromSite.normalizedDomain);
  });
});

describe("selectExistingCompany", () => {
  it("collapses the same name with different websites in one run", () => {
    const existing = [
      {
        normalized_domain: "dusk-mobile.com",
        external_id: "abc",
        normalized_name: "dusk mobile",
        company_name: "Dusk Mobile",
      },
    ];
    const incoming = resolveIncomingIdentity({
      companyName: "Dusk Mobile Inc.",
      domain: "https://www.duskmobile.com",
    });
    expect(selectExistingCompany(existing, incoming)?.normalized_domain).toBe(
      "dusk-mobile.com",
    );
  });

  it("collapses by external_id", () => {
    const existing = [
      {
        normalized_domain: "dusk-mobile.com",
        external_id: "li-1",
        normalized_name: "dusk mobile",
        company_name: "Dusk Mobile",
      },
    ];
    const incoming = resolveIncomingIdentity({
      companyName: "Dusk Mobile",
      domain: "https://app.dusk-mobile.com",
      externalId: "li-1",
    });
    expect(selectExistingCompany(existing, incoming)?.external_id).toBe("li-1");
  });
});

describe("shouldUpgradeUnresolvedDomain", () => {
  it("upgrades a sentinel domain when a real website arrives", () => {
    const incoming = resolveIncomingIdentity({
      companyName: "Dusk Mobile",
      domain: "https://dusk-mobile.com",
    });
    expect(
      shouldUpgradeUnresolvedDomain("dusk-mobile.unresolved.invalid", incoming),
    ).toBe(true);
  });
});
