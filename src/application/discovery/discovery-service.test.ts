import { describe, expect, it, vi } from "vitest";

import { AppError } from "@/domain/shared/errors";
import type {
  DiscoveredCompanyRow,
  RunIcpRow,
  RunRow,
} from "@/infrastructure/supabase/types";
import { DiscoveryService } from "./discovery-service";

function makeRun(overrides: Partial<RunRow> = {}): RunRow {
  return {
    id: "run-1",
    user_id: "user-1",
    objective: "Find 6 US B2B SaaS companies",
    status: "researching",
    qualified_target: 6,
    discovery_limit: 20,
    discovered_count: 0,
    qualified_count: 0,
    rejected_count: 0,
    discovery_cost_usd: 0,
    agent_cost_usd: 0,
    started_at: null,
    completed_at: null,
    error_message: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeCompany(
  overrides: Partial<DiscoveredCompanyRow> = {},
): DiscoveredCompanyRow {
  return {
    id: "company-1",
    run_id: "run-1",
    company_name: "Huge Corp",
    domain: "hugecorp.com",
    normalized_domain: "hugecorp.com",
    normalized_name: "huge corp",
    discovery_source: "apify",
    source_url: "https://hugecorp.com",
    external_id: "li-1",
    raw_metadata: { employee_count: 500 },
    discovered_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const approvedIcp = {
  id: "icp-1",
  run_id: "run-1",
  approved: true,
  criteria: {
    hard_filters: ["US-based", "B2B SaaS", "10-100 employees"],
    soft_signals: [],
    geography: { include: ["United States"] },
    industry: { include: ["B2B SaaS"] },
    employee_range: { min: 10, max: 100 },
  },
} as unknown as RunIcpRow;

describe("DiscoveryService", () => {
  it("releases reserved slots when the provider throws", async () => {
    const runs = {
      reserveDiscoverySlots: vi.fn().mockResolvedValue(10),
      releaseDiscoverySlots: vi.fn().mockResolvedValue(undefined),
      addCost: vi.fn(),
    };
    const events = { record: vi.fn().mockResolvedValue(undefined) };
    const provider = {
      discover: vi
        .fn()
        .mockRejectedValue(new AppError("PROVIDER_TIMEOUT", "timed out", true)),
    };
    const service = new DiscoveryService(
      runs as never,
      { upsertDiscovered: vi.fn() } as never,
      events as never,
      provider as never,
      { getApproved: vi.fn() } as never,
      { saveLead: vi.fn() } as never,
      { countFailed: vi.fn().mockResolvedValue(0) } as never,
    );

    await expect(service.discoverCompanies(makeRun(), "saas")).rejects.toMatchObject(
      { code: "PROVIDER_TIMEOUT" },
    );
    expect(runs.releaseDiscoverySlots).toHaveBeenCalledWith("run-1", 10);
  });

  it("rejects an employee-range miss before research and keeps the discovery slot", async () => {
    const company = makeCompany();
    const runs = {
      reserveDiscoverySlots: vi.fn().mockResolvedValue(10),
      releaseDiscoverySlots: vi.fn().mockResolvedValue(undefined),
      addCost: vi.fn().mockResolvedValue(undefined),
    };
    const saveLead = vi.fn().mockResolvedValue({});
    const service = new DiscoveryService(
      runs as never,
      {
        upsertDiscovered: vi
          .fn()
          .mockResolvedValue({ company, wasNew: true }),
      } as never,
      { record: vi.fn().mockResolvedValue(undefined) } as never,
      {
        discover: vi.fn().mockResolvedValue({
          companies: [
            {
              companyName: company.company_name,
              domain: company.domain,
              metadata: company.raw_metadata,
            },
          ],
        }),
      } as never,
      { getApproved: vi.fn().mockResolvedValue(approvedIcp) } as never,
      { saveLead } as never,
      { countFailed: vi.fn().mockResolvedValue(0) } as never,
    );

    const result = await service.discoverCompanies(makeRun(), "saas");

    expect(result.companies).toHaveLength(0);
    expect(result.prefiltered).toHaveLength(1);
    expect(result.prefiltered[0]?.reason).toMatch(/Employee count 500/);
    expect(saveLead).toHaveBeenCalledTimes(1);
    expect(saveLead.mock.calls[0]?.[1]).toMatchObject({
      qualification_status: "not_qualified",
    });
    // 10 reserved, 1 persisted (kept), 9 released — the reject still counts.
    expect(runs.releaseDiscoverySlots).toHaveBeenCalledWith("run-1", 9);
  });

  it("still returns a company for research when employee count is unknown", async () => {
    const company = makeCompany({
      raw_metadata: { industry: "Computer Software", location: "Austin, TX, United States" },
    });
    const saveLead = vi.fn();
    const service = new DiscoveryService(
      {
        reserveDiscoverySlots: vi.fn().mockResolvedValue(10),
        releaseDiscoverySlots: vi.fn().mockResolvedValue(undefined),
        addCost: vi.fn().mockResolvedValue(undefined),
      } as never,
      {
        upsertDiscovered: vi
          .fn()
          .mockResolvedValue({ company, wasNew: true }),
      } as never,
      { record: vi.fn().mockResolvedValue(undefined) } as never,
      {
        discover: vi.fn().mockResolvedValue({
          companies: [
            { companyName: company.company_name, domain: company.domain, metadata: company.raw_metadata },
          ],
        }),
      } as never,
      { getApproved: vi.fn().mockResolvedValue(approvedIcp) } as never,
      { saveLead } as never,
      { countFailed: vi.fn().mockResolvedValue(0) } as never,
    );

    const result = await service.discoverCompanies(makeRun(), "saas");
    expect(result.companies).toHaveLength(1);
    expect(result.prefiltered).toHaveLength(0);
    expect(saveLead).not.toHaveBeenCalled();
  });

  it("does not start another Apify run after too many discovery failures", async () => {
    const reserve = vi.fn();
    const service = new DiscoveryService(
      { reserveDiscoverySlots: reserve } as never,
      {} as never,
      {} as never,
      { discover: vi.fn() } as never,
      {} as never,
      {} as never,
      { countFailed: vi.fn().mockResolvedValue(2) } as never,
    );

    await expect(
      service.discoverCompanies(makeRun(), "saas"),
    ).rejects.toMatchObject({ code: "PROVIDER_ERROR", retryable: false });
    expect(reserve).not.toHaveBeenCalled();
  });
});
