/**
 * Whether the paid research providers have the settings a run needs.
 * Callers pass the raw env strings in and pass only the booleans to the
 * client — this module never returns a key or token.
 */
export function providerReadiness(env: {
  apifyToken?: string;
  apifyActorId?: string;
  firecrawlKey?: string;
  researchProvider?: string;
}): { discoveryConfigured: boolean; websiteResearchConfigured: boolean } {
  const discoveryConfigured = Boolean(
    env.apifyToken?.trim() && env.apifyActorId?.trim(),
  );
  const websiteResearchConfigured =
    (env.researchProvider ?? "firecrawl") !== "crawl4ai" &&
    Boolean(env.firecrawlKey?.trim());
  return { discoveryConfigured, websiteResearchConfigured };
}
