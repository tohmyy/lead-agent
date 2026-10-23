import { describe, expect, it } from "vitest";

import type { IcpCriteria } from "@/infrastructure/supabase/types";
import {
  countryFromLocation,
  prefilterFromDiscoveryMetadata,
} from "./discovery-prefilter";

const criteria: IcpCriteria = {
  hard_filters: ["US-based", "B2B SaaS", "10-100 employees"],
  soft_signals: [],
  geography: { include: ["United States"] },
  industry: { include: ["B2B SaaS"] },
  employee_range: { min: 10, max: 100 },
};

describe("prefilterFromDiscoveryMetadata", () => {
  it("rejects a known employee count outside the approved range", () => {
    const result = prefilterFromDiscoveryMetadata(criteria, {
      employee_count: 500,
    });
    expect(result.decision).toBe("reject");
    if (result.decision === "reject") {
      expect(result.dimension).toBe("employee_range");
    }
  });

  it("still researches when employee count is unknown", () => {
    expect(prefilterFromDiscoveryMetadata(criteria, {}).decision).toBe(
      "research",
    );
  });

  it("rejects a UK company when geography include is US", () => {
    const result = prefilterFromDiscoveryMetadata(criteria, {
      location: "London, United Kingdom",
    });
    expect(result.decision).toBe("reject");
    if (result.decision === "reject") {
      expect(result.dimension).toBe("geography");
    }
  });

  it("rejects consulting/staffing when the ICP wants SaaS", () => {
    const result = prefilterFromDiscoveryMetadata(criteria, {
      industry: "Business Consulting and Services",
    });
    expect(result.decision).toBe("reject");
    if (result.decision === "reject") {
      expect(result.dimension).toBe("industry");
    }
  });

  it("does not reject product-fit questions with no website evidence", () => {
    const result = prefilterFromDiscoveryMetadata(criteria, {
      employee_count: 40,
      industry: "Computer Software",
      location: "Austin, TX, United States",
    });
    expect(result.decision).toBe("research");
  });
});

describe("countryFromLocation", () => {
  it("maps common aliases", () => {
    expect(countryFromLocation("United States")).toBe("US");
    expect(countryFromLocation("London, UK")).toBe("GB");
    expect(countryFromLocation("Austin, TX, USA")).toBe("US");
  });
});
