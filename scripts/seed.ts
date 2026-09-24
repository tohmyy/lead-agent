/**
 * Creates a local dev user (if needed) and a handful of example records so
 * the UI has something to render without spending real Apify/Firecrawl
 * budget. Mirrors the record chain in docs/data-model.md section 58.
 *
 * Run after scripts/run-migrations.ts, with SUPABASE_SERVICE_ROLE_KEY and
 * NEXT_PUBLIC_SUPABASE_URL set (see .env.local).
 */
import "./load-env";

import { createClient } from "@supabase/supabase-js";

import { nodeWebSocketTransport } from "../src/lib/config/node-websocket-transport";
import type { Database } from "../src/infrastructure/supabase/types";

/**
 * Standalone scripts run under plain Node (via tsx), not through Next.js's
 * bundler, so the `server-only` import guard in
 * src/infrastructure/supabase/service-role-client.ts throws here (it only
 * no-ops under a bundler that understands the "react-server" condition).
 * This script builds its own client directly instead of reusing that
 * Next.js-specific module.
 */
function createServiceRoleSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local",
    );
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: nodeWebSocketTransport },
  });
}

async function main() {
  const supabase = createServiceRoleSupabaseClient();

  const email = process.env.SEED_USER_EMAIL ?? "dev@example.com";
  const password = process.env.SEED_USER_PASSWORD ?? "change-me-please-12345";

  const { data: existing } = await supabase.auth.admin.listUsers();
  let userId = existing?.users.find((u) => u.email === email)?.id;

  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`created seed user ${email}`);
  } else {
    console.log(`seed user ${email} already exists`);
  }

  const { data: run, error: runError } = await supabase
    .from("runs")
    .insert({
      user_id: userId,
      objective:
        "Find 10 US B2B SaaS companies with 10 to 100 employees that may need AI automation support.",
      status: "awaiting_review",
      qualified_target: 10,
      discovery_limit: 20,
      discovered_count: 1,
      qualified_count: 1,
      rejected_count: 0,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (runError) throw runError;
  console.log(`created run ${run.id}`);

  const { error: icpError } = await supabase.from("run_icps").insert({
    run_id: run.id,
    version: 1,
    source: "user",
    approved: true,
    approved_at: new Date().toISOString(),
    approved_by: userId,
    reasoning:
      "US-based B2B SaaS companies in the 10-100 employee range are small enough to lack dedicated automation staff but large enough to have repetitive operational workflows.",
    criteria: {
      geography: { include: ["United States"] },
      industry: { include: ["B2B SaaS"] },
      employee_range: { min: 10, max: 100 },
      business_model: { include: ["B2B"] },
      target_personas: ["Founder", "Operations Lead"],
      hard_filters: ["US-based", "B2B SaaS", "10-100 employees"],
      soft_signals: [
        "Operational complexity",
        "Manual workflows",
        "Growth signals",
      ],
    },
  });
  if (icpError) throw icpError;

  const { data: company, error: companyError } = await supabase
    .from("discovered_companies")
    .insert({
      run_id: run.id,
      company_name: "Acme Ops Inc.",
      domain: "acme-ops.example.com",
      normalized_domain: "acme-ops.example.com",
      discovery_source: "apify",
      source_url: "https://acme-ops.example.com",
    })
    .select()
    .single();
  if (companyError) throw companyError;

  const { data: source, error: sourceError } = await supabase
    .from("lead_sources")
    .insert({
      discovered_company_id: company.id,
      run_id: run.id,
      url: "https://acme-ops.example.com/product",
      normalized_url: "acme-ops.example.com/product",
      title: "Acme Ops - Product",
      source_type: "product",
      summary:
        "Acme Ops describes a B2B SaaS platform for operations teams, serving business customers with workflow automation features.",
      relevant_excerpt: "Automate repetitive customer operations workflows.",
      provider: "firecrawl",
    })
    .select()
    .single();
  if (sourceError) throw sourceError;

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert({
      run_id: run.id,
      discovered_company_id: company.id,
      company_name: company.company_name,
      domain: company.domain,
      qualification_status: "qualified",
      confidence_score: 91,
      fit_reasons: [
        {
          reason: "Matches employee range",
          evidence: "Company appears to have approximately 45 employees.",
          source_ids: [source.id],
        },
        {
          reason: "B2B SaaS business model",
          evidence:
            "Company describes its product as a SaaS platform for business operations teams.",
          source_ids: [source.id],
        },
      ],
      concerns: [
        {
          concern: "Employee count is approximate",
          severity: "medium",
          source_ids: [source.id],
        },
      ],
      qualification_reasoning:
        "Company matches all hard filters (US, B2B, SaaS, 10-100 employees) and shows evidence of operational workflows relevant to automation.",
      source_summary:
        "Company website describes a SaaS platform serving business customers and multiple operational workflows.",
      review_state: "not_reviewed",
      qualified_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (leadError) throw leadError;

  const { error: outreachError } = await supabase
    .from("outreach_drafts")
    .insert([
      {
        lead_id: lead.id,
        run_id: run.id,
        channel: "email",
        step: 1,
        subject: "Quick question about Acme Ops' workflow automation",
        body: "Hi {{first_name}},\n\nI noticed Acme Ops' product page highlights automating repetitive customer operations workflows. Curious how your team is currently handling that as you scale...",
        personalization_context: {
          claims: [
            {
              text: "Acme Ops' product page highlights automating repetitive customer operations workflows.",
              source_id: source.id,
            },
          ],
        },
      },
      {
        lead_id: lead.id,
        run_id: run.id,
        channel: "linkedin",
        step: null,
        subject: null,
        body: "Hi {{first_name}} — saw Acme Ops' focus on operations workflow automation and thought it was worth a quick hello. Open to a short chat?",
        personalization_context: {
          claims: [
            {
              text: "Acme Ops' product page highlights automating repetitive customer operations workflows.",
              source_id: source.id,
            },
          ],
        },
      },
    ]);
  if (outreachError) throw outreachError;

  const { error: eventError } = await supabase.from("run_events").insert([
    { run_id: run.id, event_type: "run_created", message: "Run created." },
    {
      run_id: run.id,
      event_type: "icp_approved",
      message: "ICP approved by user.",
    },
    {
      run_id: run.id,
      event_type: "lead_qualified",
      message: `${company.company_name} qualified.`,
    },
    {
      run_id: run.id,
      event_type: "outreach_completed",
      message: "Outreach drafts generated for 1 qualified lead.",
    },
  ]);
  if (eventError) throw eventError;

  console.log("Seed complete.");
  console.log(`Log in with: ${email} / ${password}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
