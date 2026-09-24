import "server-only";

import { z } from "zod";

import { DiscoveryService } from "@/application/discovery/discovery-service";
import { RunRepository } from "@/infrastructure/supabase/repositories/run-repository";
import type { ToolContext } from "./tool-context";
import { defineRunTool } from "./tool-runner";

const discoveryService = new DiscoveryService();
const runRepo = new RunRepository();

/**
 * discover_companies (TOOLS-CONTRACT.md sections 10-15): the only tool
 * allowed to spend the shared Apify budget. Deliberately has no limit
 * field — how many companies to look for is computed entirely from
 * trusted run state, never from what the agent asks for.
 */
export function createDiscoverCompaniesTool(ctx: ToolContext) {
  return defineRunTool({
    name: "discover_companies",
    description:
      "Searches for candidate companies matching the approved ICP using the configured discovery provider (Apify). Requires the ICP to be approved and the run to be actively researching. The number of results is capped by the application from the run's remaining discovery budget — you cannot request a specific count. Call get_run_context first if you're unsure how much budget remains; if it returns DISCOVERY_LIMIT_EXCEEDED or TARGET_ALREADY_REACHED, stop discovering and move on to researching/qualifying what's already been found.",
    shape: {
      query: z
        .string()
        .min(1)
        .describe(
          "A concise search query describing the target companies, derived from the approved ICP (e.g. industry, geography, size).",
        ),
    },
    purpose: "Discover candidate companies via Apify.",
    runId: ctx.runId,
    execute: async (args) => {
      const run = await runRepo.getOwnedRun(ctx.runId, ctx.userId);
      const result = await discoveryService.discoverCompanies(run, args.query);
      return {
        discovered: result.companies.map((c) => ({
          company_id: c.id,
          company_name: c.company_name,
          domain: c.domain,
        })),
        count: result.companies.length,
        provider: "apify",
        external_reference: result.externalReference,
      };
    },
  });
}
