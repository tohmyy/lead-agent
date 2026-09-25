import { describe, expect, it } from "vitest";

import { providerReadiness } from "./provider-readiness";

describe("providerReadiness", () => {
  it("returns only booleans and never the credential values", () => {
    const readiness = providerReadiness({
      apifyToken: "secret-token",
      apifyActorId: "actor-1",
      firecrawlKey: "secret-key",
      researchProvider: "firecrawl",
    });

    expect(readiness).toEqual({
      discoveryConfigured: true,
      websiteResearchConfigured: true,
    });
    expect(JSON.stringify(readiness)).not.toContain("secret");
  });

  it("reports discovery unconfigured when the actor id is missing", () => {
    expect(
      providerReadiness({
        apifyToken: "secret-token",
        firecrawlKey: "secret-key",
      }).discoveryConfigured,
    ).toBe(false);
  });
});
