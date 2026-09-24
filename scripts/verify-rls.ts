/**
 * Confirms Row Level Security actually blocks cross-user access, against a
 * real Postgres instance (RLS can't be exercised by the mocked-Supabase
 * unit tests) — BUILD-PLAN.md Phase 3's implementation order ends with
 * "test database access." Creates two throwaway users, a run + ICP row
 * owned by user A, checks user A can read their own data (positive
 * control) and user B cannot, then deletes everything it created.
 *
 * Run with: npm run db:verify-rls (requires .env.local credentials).
 */
import "./load-env";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { nodeWebSocketTransport } from "../src/lib/config/node-websocket-transport";
import type { Database } from "../src/infrastructure/supabase/types";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set in .env.local`);
  return value;
}

function serviceRoleClient(): SupabaseClient<Database> {
  return createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { autoRefreshToken: false, persistSession: false },
      realtime: { transport: nodeWebSocketTransport },
    },
  );
}

function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      auth: { autoRefreshToken: false, persistSession: false },
      realtime: { transport: nodeWebSocketTransport },
    },
  );
}

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
  }
}

async function main() {
  const admin = serviceRoleClient();
  const stamp = Date.now();
  const password = "rls-verify-throwaway-password-1!";
  const emailA = `rls-verify-a-${stamp}@example.com`;
  const emailB = `rls-verify-b-${stamp}@example.com`;

  let userAId: string | undefined;
  let userBId: string | undefined;
  let runId: string | undefined;

  try {
    const { data: userA, error: userAError } = await admin.auth.admin.createUser(
      { email: emailA, password, email_confirm: true },
    );
    if (userAError) throw userAError;
    userAId = userA.user.id;

    const { data: userB, error: userBError } = await admin.auth.admin.createUser(
      { email: emailB, password, email_confirm: true },
    );
    if (userBError) throw userBError;
    userBId = userB.user.id;

    const { data: run, error: runError } = await admin
      .from("runs")
      .insert({
        user_id: userAId,
        objective: "RLS verification run — safe to delete.",
        status: "awaiting_icp_approval",
        qualified_target: 1,
        discovery_limit: 1,
        discovered_count: 0,
        qualified_count: 0,
        rejected_count: 0,
      })
      .select()
      .single();
    if (runError) throw runError;
    runId = run.id;

    const { error: icpError } = await admin.from("run_icps").insert({
      run_id: runId,
      version: 1,
      source: "agent",
      approved: false,
      reasoning: "RLS verification fixture.",
      criteria: { hard_filters: [], soft_signals: [] },
    });
    if (icpError) throw icpError;

    console.log("Fixture created. Verifying RLS...\n");

    // Positive control: user A can read their own run + ICP.
    const asA = anonClient();
    const { error: signInAError } = await asA.auth.signInWithPassword({
      email: emailA,
      password,
    });
    if (signInAError) throw signInAError;

    const { data: aOwnRun } = await asA
      .from("runs")
      .select()
      .eq("id", runId)
      .maybeSingle();
    check("user A can read their own run", aOwnRun?.id === runId);

    const { data: aOwnIcp } = await asA
      .from("run_icps")
      .select()
      .eq("run_id", runId)
      .maybeSingle();
    check("user A can read their own run's ICP (joined policy)", !!aOwnIcp);

    // Negative control: user B cannot read user A's data.
    const asB = anonClient();
    const { error: signInBError } = await asB.auth.signInWithPassword({
      email: emailB,
      password,
    });
    if (signInBError) throw signInBError;

    const { data: bCrossRun } = await asB
      .from("runs")
      .select()
      .eq("id", runId)
      .maybeSingle();
    check("user B cannot read user A's run", bCrossRun === null);

    const { data: bCrossIcp } = await asB
      .from("run_icps")
      .select()
      .eq("run_id", runId)
      .maybeSingle();
    check("user B cannot read user A's ICP (joined policy)", bCrossIcp === null);
  } finally {
    if (runId) await admin.from("runs").delete().eq("id", runId);
    if (userAId) await admin.auth.admin.deleteUser(userAId);
    if (userBId) await admin.auth.admin.deleteUser(userBId);
    console.log("\nFixture cleaned up.");
  }

  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
