import { describe, expect, it, vi } from "vitest";

vi.mock("@/infrastructure/supabase/service-role-client", () => ({
  createServiceRoleSupabaseClient: vi.fn(),
}));

import { createServiceRoleSupabaseClient } from "@/infrastructure/supabase/service-role-client";
import { AppError } from "@/domain/shared/errors";
import { RunRepository } from "./run-repository";

/**
 * A minimal stand-in for the one query chain getOwnedRun actually uses
 * (.from("runs").select().eq("id", runId).maybeSingle()) — this app's real
 * cross-user rejection (AGENTS.md #25: "ownership checks live in exactly
 * one place") has only ever been verified live before this test; mocking
 * only the Supabase client, not the repository itself, keeps the real
 * ownership-check logic under test.
 */
function fakeSupabaseClient(row: Record<string, unknown> | null) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
  };
  return { from: vi.fn().mockReturnValue(builder) };
}

describe("RunRepository.getOwnedRun", () => {
  it("throws UNAUTHORIZED when the run belongs to a different user", async () => {
    vi.mocked(createServiceRoleSupabaseClient).mockReturnValue(
      fakeSupabaseClient({ id: "run-1", user_id: "owner-user" }) as never,
    );
    const repo = new RunRepository();

    await expect(
      repo.getOwnedRun("run-1", "attacker-user"),
    ).rejects.toMatchObject(
      expect.objectContaining({ code: "UNAUTHORIZED" }) as Partial<AppError>,
    );
  });

  it("returns the run when the caller is the owner", async () => {
    vi.mocked(createServiceRoleSupabaseClient).mockReturnValue(
      fakeSupabaseClient({ id: "run-1", user_id: "owner-user" }) as never,
    );
    const repo = new RunRepository();

    const run = await repo.getOwnedRun("run-1", "owner-user");
    expect(run.id).toBe("run-1");
  });

  it("throws RUN_NOT_FOUND when no run matches the id", async () => {
    vi.mocked(createServiceRoleSupabaseClient).mockReturnValue(
      fakeSupabaseClient(null) as never,
    );
    const repo = new RunRepository();

    await expect(
      repo.getOwnedRun("missing-run", "any-user"),
    ).rejects.toMatchObject(
      expect.objectContaining({ code: "RUN_NOT_FOUND" }) as Partial<AppError>,
    );
  });
});
