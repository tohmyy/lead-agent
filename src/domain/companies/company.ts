import { z } from "zod";

import type { QualificationStatus } from "@/infrastructure/supabase/types";

export const SOURCE_TYPES = [
  "homepage",
  "about",
  "product",
  "services",
  "pricing",
  "careers",
  "blog",
  "other",
] as const;

export type CompanyResearchOutcome = QualificationStatus | "not_researched";

export function companyResearchOutcome(
  companyId: string,
  leads: Array<{
    discovered_company_id: string;
    qualification_status: QualificationStatus;
  }>,
): CompanyResearchOutcome {
  const lead = leads.find((item) => item.discovered_company_id === companyId);
  return lead?.qualification_status ?? "not_researched";
}

export const recordSourceInputSchema = z.object({
  company_id: z.string().uuid(),
  url: z.string().url(),
  title: z.string().optional(),
  source_type: z.enum(SOURCE_TYPES),
  summary: z.string().min(1).max(2000),
  relevant_excerpt: z.string().max(1000).optional(),
  provider: z.string().optional(),
});
