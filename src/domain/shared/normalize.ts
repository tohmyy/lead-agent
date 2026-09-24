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
