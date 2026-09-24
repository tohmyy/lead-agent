import { z } from "zod";

import { SOURCE_TYPES } from "@/domain/companies/company";
import { icpCriteriaSchema } from "@/domain/icp/icp";
import { QUALIFICATION_STATUSES } from "@/domain/leads/lead";
import { RUN_STATUSES } from "@/domain/runs/run";

/**
 * One Zod schema per agent tool, validating what `execute()` actually
 * returns before it's sent to the agent (BUILD-PLAN.md section 13 lists
 * "output schema" as its own required property, alongside "input schema").
 * A shape mismatch here means a service's return type drifted out of sync
 * with a tool's mapping code — that should surface as a clear
 * INTERNAL_ERROR, not a malformed result the agent has to puzzle over.
 *
 * Nested raw DB rows (`company`, `sources` in get_company_context) are
 * checked by identity fields with `.passthrough()` rather than
 * re-specifying every column — that validation already exists at the DB
 * (CHECK constraints) and domain (Zod input) layers.
 */

export const getRunContextOutputSchema = z.object({
  run_id: z.string().uuid(),
  objective: z.string(),
  status: z.enum(RUN_STATUSES as [string, ...string[]]),
  qualified_target: z.number(),
  discovery_limit: z.number(),
  discovered_count: z.number(),
  qualified_count: z.number(),
  rejected_count: z.number(),
  approved_icp: icpCriteriaSchema.nullable(),
});

export const saveIcpOutputSchema = z.object({
  icp_id: z.string().uuid(),
  version: z.number(),
  status: z.literal("awaiting_approval"),
});

export const discoverCompaniesOutputSchema = z.object({
  discovered: z.array(
    z.object({
      company_id: z.string().uuid(),
      company_name: z.string(),
      domain: z.string(),
    }),
  ),
  count: z.number(),
  provider: z.literal("apify"),
  external_reference: z.string().optional(),
  cost_usd: z.number().optional(),
});

const researchedSourceSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  source_type: z.enum(SOURCE_TYPES),
  summary: z.string(),
  relevant_excerpt: z.string().optional(),
});

export const researchWebsiteOutputSchema = z.object({
  company_id: z.string().uuid(),
  sources: z.array(researchedSourceSchema),
});

export const recordSourceOutputSchema = z.object({
  source_id: z.string().uuid(),
});

const fitReasonOutputSchema = z.object({
  reason: z.string(),
  evidence: z.string().optional(),
  source_ids: z.array(z.string().uuid()),
});

const concernOutputSchema = z.object({
  concern: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  source_ids: z.array(z.string().uuid()),
});

export const getCompanyContextOutputSchema = z.object({
  company: z
    .object({
      name: z.string(),
      domain: z.string(),
      discoverySource: z.string().optional(),
    })
    .passthrough(),
  sources: z.array(z.object({ id: z.string().uuid() }).passthrough()),
  existing_lead: z
    .object({
      lead_id: z.string().uuid(),
      qualification_status: z.enum(QUALIFICATION_STATUSES),
      confidence_score: z.number().nullable(),
      fit_reasons: z.array(fitReasonOutputSchema),
      concerns: z.array(concernOutputSchema),
      qualification_reasoning: z.string(),
    })
    .nullable(),
});

export const saveLeadOutputSchema = z.object({
  lead_id: z.string().uuid(),
  qualification_status: z.enum(QUALIFICATION_STATUSES),
  confidence_score: z.number().nullable(),
});

export const saveOutreachDraftOutputSchema = z.object({
  outreach_draft_id: z.string().uuid(),
  channel: z.enum(["email", "linkedin"]),
  step: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
  version: z.number(),
});

export const recordRunEventOutputSchema = z.object({
  event_id: z.string().uuid(),
});
