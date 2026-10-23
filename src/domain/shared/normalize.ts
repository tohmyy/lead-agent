import { AppError } from "./errors";

/**
 * Normalizes a domain/URL for deduplication (data-model.md section 42/14):
 *   https://www.Acme.com/  ->  acme.com
 * Strips protocol, "www.", trailing slash, path/query, and lowercases.
 */
export function normalizeDomain(input: string): string {
  let value = input.trim().toLowerCase();
  value = value.replace(/^[a-z]+:\/\//, "");
  value = value.replace(/^www\./, "");
  value = value.split("/")[0];
  value = value.split("?")[0];
  value = value.split(":")[0];
  return value;
}

/**
 * Normalizes a company name before persistence (data-model.md section 17):
 * trims and collapses internal whitespace. Deliberately minimal — no
 * title-casing or legal-suffix stripping ("Inc."/"LLC"), which would risk
 * altering a real name for no requirement anyone asked for.
 */
export function normalizeCompanyName(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

/**
 * Profile / social hosts that must never be treated as a company website.
 * Apify LinkedIn actors often return the profile URL in `url`/`website`.
 */
const PROFILE_HOSTS = new Set([
  "linkedin.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "crunchbase.com",
]);

const LEGAL_SUFFIX =
  /\b(inc|llc|ltd|corp|co|incorporated|limited|corporation)\b\.?/g;

/** True when the hostname is a social/profile network, not a company site. */
export function isProfileHost(input: string): boolean {
  const host = normalizeDomain(input);
  if (!host) return false;
  if (PROFILE_HOSTS.has(host)) return true;
  for (const profile of PROFILE_HOSTS) {
    if (host.endsWith(`.${profile}`)) return true;
  }
  return false;
}

/**
 * Comparison key for in-run name collapse: lowercase, strip punctuation
 * and legal suffixes so "Dusk Mobile Inc." matches "Dusk Mobile".
 */
export function companyNameKey(input: string): string {
  return normalizeCompanyName(input)
    .toLowerCase()
    .replace(/[.,'"()]/g, " ")
    .replace(LEGAL_SUFFIX, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const UNRESOLVED_SUFFIX = ".unresolved.invalid";

/** Sentinel hostname used when discovery had no public company website. */
export function unresolvedDomainForName(name: string): string {
  const slug = companyNameKey(name).replace(/\s+/g, "-") || "unknown";
  return `${slug}${UNRESOLVED_SUFFIX}`;
}

/** False for social hosts and for the no-website sentinel — do not Firecrawl. */
export function isResearchableDomain(input: string): boolean {
  const host = normalizeDomain(input);
  if (!host) return false;
  if (host.endsWith(UNRESOLVED_SUFFIX)) return false;
  return !isProfileHost(host);
}

/**
 * Normalizes a full URL for source-deduplication (TOOL-CONTRACTS.md
 * section 43): same host normalization as normalizeDomain, but preserves
 * the path (not the query string or fragment) since two different pages
 * on the same domain are different sources.
 */
export function normalizeUrl(input: string): string {
  const parsed = parseUrlStrict(input);
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const pathname = parsed.pathname.replace(/\/+$/, "");
  return `${host}${pathname}`;
}

export function parseUrlStrict(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new AppError("INVALID_URL", "The provided value is not a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AppError(
      "INVALID_URL",
      "Only http and https URLs are supported.",
    );
  }
  return url;
}
