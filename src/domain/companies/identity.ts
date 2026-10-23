import {
  companyNameKey,
  isResearchableDomain,
  normalizeCompanyName,
  normalizeDomain,
  unresolvedDomainForName,
} from "@/domain/shared/normalize";

export type IncomingCompanyIdentity = {
  displayName: string;
  nameKey: string;
  domain: string;
  normalizedDomain: string;
  researchable: boolean;
  sourceUrl?: string;
  externalId?: string;
};

/**
 * Picks the identity we persist for a discovery result: a real company
 * hostname when we have one, otherwise a unique no-website sentinel so
 * LinkedIn profile URLs cannot collide with (or become) the company domain.
 */
export function resolveIncomingIdentity(input: {
  companyName: string;
  domain: string;
  sourceUrl?: string;
  externalId?: string;
}): IncomingCompanyIdentity {
  const displayName = normalizeCompanyName(input.companyName);
  const nameKey = companyNameKey(input.companyName);
  const incomingHost = normalizeDomain(input.domain);
  const researchable = isResearchableDomain(incomingHost);
  const normalizedDomain = researchable
    ? incomingHost
    : unresolvedDomainForName(input.companyName);

  return {
    displayName,
    nameKey,
    domain: researchable ? input.domain : normalizedDomain,
    normalizedDomain,
    researchable,
    sourceUrl: input.sourceUrl,
    externalId: input.externalId,
  };
}

/**
 * In-run duplicate: same normalized domain, same external_id, or same
 * name key. Name collapse is application-level (two real Acmes can exist
 * across runs); within one run we treat the same name as the same company.
 */
export function selectExistingCompany<
  T extends {
    normalized_domain: string;
    external_id: string | null;
    normalized_name?: string | null;
    company_name: string;
  },
>(existing: T[], incoming: IncomingCompanyIdentity): T | undefined {
  const byDomain = existing.find(
    (row) => row.normalized_domain === incoming.normalizedDomain,
  );
  if (byDomain) return byDomain;

  if (incoming.externalId) {
    const byExternal = existing.find(
      (row) => row.external_id === incoming.externalId,
    );
    if (byExternal) return byExternal;
  }

  return existing.find(
    (row) =>
      (row.normalized_name ?? companyNameKey(row.company_name)) ===
      incoming.nameKey,
  );
}

/** True when the stored row has no public site and the incoming one does. */
export function shouldUpgradeUnresolvedDomain(
  existingNormalizedDomain: string,
  incoming: IncomingCompanyIdentity,
): boolean {
  return (
    incoming.researchable && !isResearchableDomain(existingNormalizedDomain)
  );
}
