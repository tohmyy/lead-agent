import { z } from "zod";

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

export const recordSourceInputSchema = z.object({
  company_id: z.string().uuid(),
  url: z.string().url(),
  title: z.string().optional(),
  source_type: z.enum(SOURCE_TYPES),
  summary: z.string().min(1).max(2000),
  relevant_excerpt: z.string().max(1000).optional(),
  provider: z.string().optional(),
});
