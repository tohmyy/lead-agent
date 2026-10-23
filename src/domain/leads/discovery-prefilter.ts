import {
  employeeCountFromMetadata,
  industryFromMetadata,
  locationFromMetadata,
} from "@/domain/leads/lead";
import type {
  HardFilterResult,
  IcpCriteria,
} from "@/infrastructure/supabase/types";

export type PrefilterDimension = "employee_range" | "geography" | "industry";

export type DiscoveryPrefilterResult =
  | { decision: "research" }
  | {
      decision: "reject";
      dimension: PrefilterDimension;
      reason: string;
      evidence: string;
    };

const COUNTRY_ALIASES: Record<string, string> = {
  us: "US",
  usa: "US",
  "united states": "US",
  "united states of america": "US",
  america: "US",
  uk: "GB",
  "united kingdom": "GB",
  britain: "GB",
  "great britain": "GB",
  england: "GB",
  gb: "GB",
  ca: "CA",
  canada: "CA",
  de: "DE",
  germany: "DE",
  fr: "FR",
  france: "FR",
  au: "AU",
  australia: "AU",
  in: "IN",
  india: "IN",
  nl: "NL",
  netherlands: "NL",
  ie: "IE",
  ireland: "IE",
};

const SAAS_INCLUDE_HINTS = ["saas", "software", "b2b saas"];

const NON_SAAS_INDUSTRY_HINTS = [
  "staffing",
  "recruiting",
  "human resources",
  "marketing and advertising",
  "advertising services",
  "business consulting",
  "management consulting",
  "public relations",
  "it services and it consulting",
];

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function canonicalizeCountry(value: string): string | null {
  const token = normalizeToken(value);
  if (COUNTRY_ALIASES[token]) return COUNTRY_ALIASES[token];
  for (const [alias, code] of Object.entries(COUNTRY_ALIASES)) {
    if (token === alias || token.endsWith(` ${alias}`) || token.startsWith(`${alias} `)) {
      return code;
    }
  }
  return null;
}

export function countryFromLocation(location: string): string | null {
  const parts = location.split(",").map((part) => part.trim()).filter(Boolean);
  for (const part of [...parts].reverse()) {
    const code = canonicalizeCountry(part);
    if (code) return code;
  }
  return canonicalizeCountry(location);
}

function criteriaCountries(values: string[] | undefined): string[] {
  if (!values) return [];
  return values
    .map((value) => canonicalizeCountry(value) ?? normalizeToken(value).toUpperCase())
    .filter(Boolean);
}

function employeeOutOfRange(
  count: number,
  range: { min?: number; max?: number },
): boolean {
  if (typeof range.min === "number" && count < range.min) return true;
  if (typeof range.max === "number" && count > range.max) return true;
  return false;
}

function includesHint(value: string, hints: string[]): boolean {
  const token = normalizeToken(value);
  return hints.some((hint) => token.includes(hint));
}

function industryExcluded(
  discovered: string,
  exclude: string[] | undefined,
): boolean {
  if (!exclude?.length) return false;
  const discoveredToken = normalizeToken(discovered);
  return exclude.some((entry) => {
    const token = normalizeToken(entry);
    return token.length > 0 && discoveredToken.includes(token);
  });
}

function industryIncludeMismatch(
  discovered: string,
  include: string[] | undefined,
): boolean {
  if (!include?.length) return false;
  const wantsSaas = include.some((entry) => includesHint(entry, SAAS_INCLUDE_HINTS));
  if (!wantsSaas) return false;
  return includesHint(discovered, NON_SAAS_INDUSTRY_HINTS);
}

/**
 * Conservative discovery-time gate. Auto-reject only when structured ICP
 * fields clearly contradict Apify metadata; missing data means "research".
 * Product-fit hard filters (what the company sells) still need a scrape.
 */
export function prefilterFromDiscoveryMetadata(
  criteria: IcpCriteria,
  metadata: Record<string, unknown> | null | undefined,
): DiscoveryPrefilterResult {
  const employeeCount = employeeCountFromMetadata(metadata);
  if (employeeCount !== null && criteria.employee_range) {
    if (employeeOutOfRange(employeeCount, criteria.employee_range)) {
      return {
        decision: "reject",
        dimension: "employee_range",
        reason: `Employee count ${employeeCount} is outside the approved range.`,
        evidence: `Discovery metadata employee_count=${employeeCount}`,
      };
    }
  }

  const location = locationFromMetadata(metadata);
  if (location) {
    const country = countryFromLocation(location);
    if (country) {
      const include = criteriaCountries(criteria.geography?.include);
      const exclude = criteriaCountries(criteria.geography?.exclude);
      if (exclude.includes(country)) {
        return {
          decision: "reject",
          dimension: "geography",
          reason: `Company location ${location} is in an excluded geography.`,
          evidence: `Discovery metadata location=${location}`,
        };
      }
      if (include.length > 0 && !include.includes(country)) {
        return {
          decision: "reject",
          dimension: "geography",
          reason: `Company location ${location} is outside the included geography.`,
          evidence: `Discovery metadata location=${location}`,
        };
      }
    }
  }

  const industry = industryFromMetadata(metadata);
  if (industry) {
    if (industryExcluded(industry, criteria.industry?.exclude)) {
      return {
        decision: "reject",
        dimension: "industry",
        reason: `Industry "${industry}" is excluded by the approved ICP.`,
        evidence: `Discovery metadata industry=${industry}`,
      };
    }
    if (industryIncludeMismatch(industry, criteria.industry?.include)) {
      return {
        decision: "reject",
        dimension: "industry",
        reason: `Industry "${industry}" does not match the approved ICP industry.`,
        evidence: `Discovery metadata industry=${industry}`,
      };
    }
  }

  return { decision: "research" };
}

function dimensionForFilterText(filter: string): PrefilterDimension | null {
  const text = filter.toLowerCase();
  if (/\b(employee|employees|headcount|staff|\d+\s*[-–to]+\s*\d+)\b/.test(text)) {
    return "employee_range";
  }
  if (
    /\b(us[- ]?based|united states|uk[- ]?based|united kingdom|geograph|country|located|canada|germany)\b/.test(
      text,
    )
  ) {
    return "geography";
  }
  if (/\b(saas|software|industr|b2b|fintech|agency)\b/.test(text)) {
    return "industry";
  }
  return null;
}

export function hardFilterResultsForPrefilter(
  hardFilters: string[],
  failedDimension: PrefilterDimension | null,
  evidence?: string,
): HardFilterResult[] {
  return hardFilters.map((filter) => {
    if (
      failedDimension &&
      dimensionForFilterText(filter) === failedDimension
    ) {
      return { filter, result: "fail" as const, evidence };
    }
    return { filter, result: "unknown" as const };
  });
}
