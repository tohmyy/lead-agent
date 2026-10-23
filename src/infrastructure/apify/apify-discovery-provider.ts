import "server-only";

import { ApifyClient } from "apify-client";

import { AppError } from "@/domain/shared/errors";
import { getServerEnv } from "@/lib/config/env";
import type {
  CompanyDiscoveryProvider,
  DiscoveredCompanyResult,
  DiscoveryRequest,
  DiscoveryResult,
} from "./discovery-provider";
import { normalizeDiscoveryItem } from "./normalize-discovery-item";

const RUN_TIMEOUT_SECS = 120;

/** Apify pricing models that indicate a flat-fee "rental" actor — never allowed (AGENTS.md #16). */
const RENTAL_PRICING_MODELS = new Set(["FLAT_PRICE_PER_MONTH"]);

export class ApifyDiscoveryProvider implements CompanyDiscoveryProvider {
  private _client: ApifyClient | undefined;
  private _actorId: string | undefined;

  /**
   * Deliberately lazy: reading env vars / constructing the Apify client
   * happens on first actual use, not in the constructor. Application
   * services construct a default provider instance as a class-field
   * default (e.g. `new DiscoveryService()`), which several server-action
   * modules import at the top level — an eager constructor here would make
   * `getServerEnv()` throw during Next.js's build-time route analysis,
   * long before any request (and real env vars) exist.
   */
  private init(): { client: ApifyClient; actorId: string } {
    if (!this._client || !this._actorId) {
      const env = getServerEnv();
      if (!env.APIFY_DISCOVERY_ACTOR_ID) {
        throw new AppError(
          "INVALID_DISCOVERY_PROVIDER",
          "APIFY_DISCOVERY_ACTOR_ID is not configured.",
        );
      }
      this._client = new ApifyClient({ token: env.APIFY_API_TOKEN });
      this._actorId = env.APIFY_DISCOVERY_ACTOR_ID;
    }
    return { client: this._client, actorId: this._actorId };
  }

  async discover(request: DiscoveryRequest): Promise<DiscoveryResult> {
    const { client, actorId } = this.init();
    return this.doDiscover(client, actorId, request);
  }

  private async doDiscover(
    client: ApifyClient,
    actorId: string,
    request: DiscoveryRequest,
  ): Promise<DiscoveryResult> {
    if (request.maxItems <= 0) {
      throw new AppError(
        "SAFETY_VALIDATION_FAILED",
        "Discovery requires a positive hard limit; refusing to start an uncapped run.",
      );
    }

    await this.assertNotRentalActor(client, actorId);

    let run;
    try {
      run = await client.actor(actorId).call(
        {
          // Different discovery actors name their search-term input
          // differently (this is an admin-configured, swappable actor —
          // AGENTS.md non-goal against hardcoding one specific provider).
          // Sending every known alias is harmless: actors ignore
          // properties their input schema doesn't declare.
          query: request.query,
          searchQuery: request.query,
          searchTerms: [request.query],
          maxItems: request.maxItems,
          resultsPerSearch: request.maxItems,
          maxCrawledPlaces: request.maxItems,
          // harvestapi/linkedin-company-search-specific: "full" mode is
          // the only mode that returns a company `website` field, which
          // discover_companies' domain normalization requires — "short"
          // mode omits it entirely and every result would be dropped.
          scraperMode: "full",
        },
        { waitSecs: RUN_TIMEOUT_SECS },
      );
    } catch {
      throw new AppError(
        "PROVIDER_ERROR",
        "Company discovery failed because the external provider returned an error.",
        false,
      );
    }

    if (run.status === "RUNNING" || run.status === "READY") {
      // Exceeded our wait budget — this is the "abort if unexpected" rule
      // (BUILD-PLAN.md section 16 / AGENTS.md #17): never let a run keep
      // spending in the background unmonitored.
      await client
        .run(run.id)
        .abort()
        .catch(() => undefined);
      throw new AppError(
        "PROVIDER_TIMEOUT",
        "Company discovery did not complete within the expected time and was aborted.",
        true,
      );
    }

    if (run.status !== "SUCCEEDED") {
      throw new AppError(
        "PROVIDER_ERROR",
        `Company discovery run ended with unexpected status: ${run.status}.`,
        false,
      );
    }

    const { items } = await client
      .dataset(run.defaultDatasetId)
      .listItems({ limit: request.maxItems });

    const companies: DiscoveredCompanyResult[] = [];
    for (const item of items as Record<string, unknown>[]) {
      const normalized = normalizeDiscoveryItem(item);
      if (normalized) companies.push(normalized);
      if (companies.length >= request.maxItems) break;
    }

    const stats = (run as unknown as { usageTotalUsd?: number }).usageTotalUsd;

    return {
      companies,
      externalReference: run.id,
      costUsd: typeof stats === "number" ? stats : undefined,
    };
  }

  /**
   * Best-effort rental-actor guard. Apify's actor pricing metadata isn't
   * always available through this endpoint for every account/actor
   * combination; when it can't be determined, this does not block
   * execution — BUILD-PLAN.md section 55 requires manually confirming
   * actor pricing in the Apify console before the real assessment run
   * regardless.
   */
  private async assertNotRentalActor(
    client: ApifyClient,
    actorId: string,
  ): Promise<void> {
    try {
      const actor = await client.actor(actorId).get();
      const pricingModel = (
        actor as unknown as { pricingInfos?: Array<{ pricingModel?: string }> }
      )?.pricingInfos?.at(-1)?.pricingModel;
      if (pricingModel && RENTAL_PRICING_MODELS.has(pricingModel)) {
        throw new AppError(
          "SAFETY_VALIDATION_FAILED",
          "This Apify actor uses rental (flat monthly fee) pricing, which is not permitted. Configure a pay-per-event actor instead.",
        );
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      // Could not fetch pricing metadata — proceed, but this must be
      // manually confirmed per BUILD-PLAN.md section 55.
    }
  }
}
