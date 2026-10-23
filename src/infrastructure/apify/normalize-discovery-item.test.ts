import { describe, expect, it } from "vitest";

import { normalizeDiscoveryItem } from "./normalize-discovery-item";

describe("normalizeDiscoveryItem", () => {
  it("prefers a real website over a LinkedIn profile URL", () => {
    const result = normalizeDiscoveryItem({
      companyName: "Dusk Mobile",
      website: "https://dusk-mobile.com",
      url: "https://www.linkedin.com/company/dusk-mobile",
      employeeCount: 42,
      industry: "Computer Software",
      location: "Austin, TX",
      id: "li-1",
    });
    expect(result?.domain).toBe("https://dusk-mobile.com");
    expect(result?.metadata?.employee_count).toBe(42);
    expect(result?.metadata?.industry).toBe("Computer Software");
    expect(result?.metadata?.location).toBe("Austin, TX");
    expect(result?.externalId).toBe("li-1");
  });

  it("falls back to the LinkedIn URL only when no website exists", () => {
    const result = normalizeDiscoveryItem({
      name: "Dusk Mobile",
      url: "https://www.linkedin.com/company/dusk-mobile",
    });
    expect(result?.domain).toContain("linkedin.com");
  });
});
