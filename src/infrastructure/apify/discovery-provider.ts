export interface DiscoveryRequest {
  /** Free-text or structured query derived from the approved ICP. */
  query: string;
  /** Hard cap on results for this call — already limit-checked by the caller. */
  maxItems: number;
}

export interface DiscoveredCompanyResult {
  companyName: string;
  domain: string;
  sourceUrl?: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
}

export interface DiscoveryResult {
  companies: DiscoveredCompanyResult[];
  externalReference?: string;
  costUsd?: number;
}

/**
 * Discovery provider abstraction (ARCHITECTURE2.md section 65 /
 * TOOLS-CONTRACT.md section 56) — the application depends on this
 * interface, never on Apify's SDK types directly, so the provider can be
 * replaced without touching DiscoveryService or the discover_companies tool.
 */
export interface CompanyDiscoveryProvider {
  discover(request: DiscoveryRequest): Promise<DiscoveryResult>;
}
