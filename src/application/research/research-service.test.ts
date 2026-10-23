import { describe, expect, it, vi } from "vitest";

import { AppError } from "@/domain/shared/errors";
import type {
  DiscoveredCompanyRow,
  RunRow,
} from "@/infrastructure/supabase/types";
import { ResearchService } from "./research-service";

function makeRun(): RunRow {
  return {
    id: "run-1",
    user_id: "user-1",
    objective: "Find companies",
    status: "researching",
    qualified_target: 6,
    discovery_limit: 20,
    discovered_count: 1,
    qualified_count: 0,
    rejected_count: 0,
    discovery_cost_usd: 0,
    agent_cost_usd: 0,
    started_at: null,
    completed_at: null,
    error_message: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function makeCompany(): DiscoveredCompanyRow {
  return {
    id: "company-1",
    run_id: "run-1",
    company_name: "Dusk Mobile",
    domain: "dusk-mobile.com",
    normalized_domain: "dusk-mobile.com",
    normalized_name: "dusk mobile",
    discovery_source: "apify",
    source_url: "https://dusk-mobile.com",
    external_id: "li-1",
    raw_metadata: {},
    discovered_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

const homepage = {
  url: "https://dusk-mobile.com",
  title: "Dusk",
  sourceType: "homepage" as const,
  summary: "Field service software.",
};

describe("ResearchService.researchWebsite", () => {
  it("does not call the provider when the domain is already in cache", async () => {
    const research = vi.fn();
    const events = { record: vi.fn().mockResolvedValue(undefined) };
    const service = new ResearchService(
      { getOwned: vi.fn().mockResolvedValue(makeCompany()) } as never,
      { listForCompany: vi.fn().mockResolvedValue([]) } as never,
      events as never,
      { research } as never,
      {
        getFreshFailure: vi.fn().mockResolvedValue(null),
        listFreshForDomain: vi.fn().mockResolvedValue([
          {
            normalized_url: "dusk-mobile.com",
            normalized_domain: "dusk-mobile.com",
            title: "Dusk",
            source_type: "homepage",
            summary: "Field service software.",
            relevant_excerpt: null,
          },
          {
            normalized_url: "dusk-mobile.com/about",
            normalized_domain: "dusk-mobile.com",
            title: "About",
            source_type: "about",
            summary: "About Dusk.",
            relevant_excerpt: null,
          },
        ]),
        upsertPages: vi.fn(),
        recordFailure: vi.fn(),
      } as never,
    );

    const result = await service.researchWebsite(makeRun(), "company-1");
    expect(research).not.toHaveBeenCalled();
    expect(result.sources.length).toBeGreaterThan(0);
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "company_research_completed" }),
    );
  });

  it("retries an empty scrape once, then fails closed without inviting another paid call", async () => {
    const research = vi
      .fn()
      .mockRejectedValue(
        new AppError(
          "PROVIDER_ERROR",
          "Website research did not return any usable content for this company.",
          false,
        ),
      );
    const recordFailure = vi.fn().mockResolvedValue(undefined);
    const events = { record: vi.fn().mockResolvedValue(undefined) };
    const service = new ResearchService(
      { getOwned: vi.fn().mockResolvedValue(makeCompany()) } as never,
      { listForCompany: vi.fn().mockResolvedValue([]) } as never,
      events as never,
      { research } as never,
      {
        getFreshFailure: vi.fn().mockResolvedValue(null),
        listFreshForDomain: vi.fn().mockResolvedValue([]),
        upsertPages: vi.fn(),
        recordFailure,
      } as never,
    );

    await expect(
      service.researchWebsite(makeRun(), "company-1"),
    ).rejects.toMatchObject({ code: "PROVIDER_ERROR", retryable: false });
    expect(research).toHaveBeenCalledTimes(2);
    expect(recordFailure).toHaveBeenCalled();
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "company_research_failed" }),
    );
  });

  it("skips Firecrawl for a LinkedIn-only sentinel domain", async () => {
    const research = vi.fn();
    const company = {
      ...makeCompany(),
      normalized_domain: "dusk-mobile.unresolved.invalid",
      domain: "dusk-mobile.unresolved.invalid",
    };
    const service = new ResearchService(
      { getOwned: vi.fn().mockResolvedValue(company) } as never,
      { listForCompany: vi.fn() } as never,
      { record: vi.fn().mockResolvedValue(undefined) } as never,
      { research } as never,
    );

    await expect(
      service.researchWebsite(makeRun(), "company-1"),
    ).rejects.toMatchObject({ retryable: false });
    expect(research).not.toHaveBeenCalled();
  });

  it("does not scrape a domain with a fresh negative cache", async () => {
    const research = vi.fn();
    const service = new ResearchService(
      { getOwned: vi.fn().mockResolvedValue(makeCompany()) } as never,
      { listForCompany: vi.fn() } as never,
      { record: vi.fn().mockResolvedValue(undefined) } as never,
      { research } as never,
      {
        getFreshFailure: vi.fn().mockResolvedValue({
          normalized_domain: "dusk-mobile.com",
          error_message: "empty",
          failed_at: new Date().toISOString(),
        }),
        listFreshForDomain: vi.fn(),
      } as never,
    );

    await expect(
      service.researchWebsite(makeRun(), "company-1"),
    ).rejects.toMatchObject({ retryable: false });
    expect(research).not.toHaveBeenCalled();
  });
});

describe("ResearchService scrape reuse", () => {
  it("does not re-call the provider for a URL already recorded on the company", async () => {
    const research = vi.fn();
    const service = new ResearchService(
      { getOwned: vi.fn().mockResolvedValue(makeCompany()) } as never,
      {
        listForCompany: vi.fn().mockResolvedValue([
          {
            url: "https://dusk-mobile.com",
            normalized_url: "dusk-mobile.com",
            title: "Home",
            source_type: "homepage",
            summary: "Home",
            relevant_excerpt: null,
          },
          {
            url: "https://dusk-mobile.com/about",
            normalized_url: "dusk-mobile.com/about",
            title: "About",
            source_type: "about",
            summary: "About",
            relevant_excerpt: null,
          },
        ]),
      } as never,
      { record: vi.fn().mockResolvedValue(undefined) } as never,
      { research } as never,
      {
        getFreshFailure: vi.fn().mockResolvedValue(null),
        listFreshForDomain: vi.fn().mockResolvedValue([]),
        upsertPages: vi.fn(),
      } as never,
    );

    await service.researchWebsite(makeRun(), "company-1");
    expect(research).not.toHaveBeenCalled();
    expect(homepage.summary).toBeTruthy();
  });
});
