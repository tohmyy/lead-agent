import { z } from "zod";

/**
 * ICP criteria shape (data-model.md section 9 / TOOLS-CONTRACT.md section 8).
 * hard_filters are mandatory constraints; soft_signals are evidence used to
 * judge fit but must never be treated as equally weighted (AGENTS.md #31).
 */
export const icpCriteriaSchema = z.object({
  geography: z
    .object({
      include: z.array(z.string()).optional(),
      exclude: z.array(z.string()).optional(),
    })
    .optional(),
  industry: z
    .object({
      include: z.array(z.string()).optional(),
      exclude: z.array(z.string()).optional(),
    })
    .optional(),
  employee_range: z
    .object({
      min: z.number().int().nonnegative().optional(),
      max: z.number().int().nonnegative().optional(),
    })
    .optional(),
  business_model: z
    .object({ include: z.array(z.string()).optional() })
    .optional(),
  target_personas: z.array(z.string()).optional(),
  hard_filters: z
    .array(z.string())
    .min(1, "At least one hard filter is required."),
  soft_signals: z.array(z.string()),
});

export type IcpCriteriaInput = z.infer<typeof icpCriteriaSchema>;

export const saveIcpInputSchema = z.object({
  criteria: icpCriteriaSchema,
  reasoning: z.string().min(1),
});
