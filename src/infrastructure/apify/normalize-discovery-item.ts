import { isProfileHost } from "@/domain/shared/normalize";
import type { DiscoveredCompanyResult } from "./discovery-provider";

function pickFirstString(
  obj: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim().length > 0)
      return value.trim();
  }
  return undefined;
}

function pickEmployeeCount(item: Record<string, unknown>): number | undefined {
  for (const key of ["employeeCount", "employee_count", "staffCount"]) {
    const value = item[key];
    if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
      return value;
    }
    if (typeof value === "string" && /^\d+$/.test(value.trim())) {
      return Number.parseInt(value.trim(), 10);
    }
  }
  return undefined;
}

function pickIndustry(item: Record<string, unknown>): string | undefined {
  const direct = pickFirstString(item, ["industry"]);
  if (direct) return direct;
  const industries = item.industries;
  if (Array.isArray(industries) && industries.length > 0) {
    const first = industries[0];
    if (typeof first === "string" && first.trim()) return first.trim();
    if (first && typeof first === "object") {
      const name = (first as { name?: unknown }).name;
      if (typeof name === "string" && name.trim()) return name.trim();
    }
  }
  return undefined;
}

function pickLocation(item: Record<string, unknown>): string | undefined {
  const direct = pickFirstString(item, [
    "location",
    "headquartersLocation",
    "country",
    "geo",
  ]);
  if (direct) return direct;
  const hq = item.headquarters ?? item.headquarter ?? item.hq;
  if (typeof hq === "string" && hq.trim()) return hq.trim();
  if (hq && typeof hq === "object") {
    const obj = hq as Record<string, unknown>;
    const parts = [obj.city, obj.geographicArea, obj.country, obj.countryCode]
      .filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
      .map((value) => value.trim());
    if (parts.length > 0) return parts.join(", ");
  }
  return undefined;
}

function pickCompanyDomain(item: Record<string, unknown>): string | undefined {
  const candidates = [
    pickFirstString(item, ["domain", "website", "companyUrl", "site"]),
    pickFirstString(item, ["url"]),
  ].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    if (!isProfileHost(candidate)) return candidate;
  }
  return candidates[0];
}

/** Maps a raw Apify item onto the application discovery shape. */
export function normalizeDiscoveryItem(
  item: Record<string, unknown>,
): DiscoveredCompanyResult | null {
  const companyName = pickFirstString(item, [
    "companyName",
    "name",
    "title",
    "company",
  ]);
  const domain = pickCompanyDomain(item);
  if (!companyName || !domain) return null;

  const employeeCount = pickEmployeeCount(item);
  const industry = pickIndustry(item);
  const location = pickLocation(item);

  return {
    companyName,
    domain,
    sourceUrl: pickFirstString(item, [
      "sourceUrl",
      "url",
      "profileUrl",
      "linkedinUrl",
    ]),
    externalId: pickFirstString(item, ["id", "placeId", "externalId"]),
    metadata: {
      ...item,
      ...(employeeCount !== undefined ? { employee_count: employeeCount } : {}),
      ...(industry ? { industry } : {}),
      ...(location ? { location } : {}),
    },
  };
}
