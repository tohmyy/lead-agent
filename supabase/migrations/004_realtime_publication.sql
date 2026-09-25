-- BUILD-PLAN.md section 50 ("Phase 15 — Realtime Activity"): adds the
-- tables relevant to an active run's detail view to the supabase_realtime
-- publication. Without this, postgres_changes subscriptions silently
-- receive zero events regardless of how correct the client-side
-- subscription code is — RLS (002_row_level_security.sql) already scopes
-- what each subscriber can see, this just turns broadcasting on.
-- discovered_companies is deliberately not included: the "companies
-- discovered" count the UI shows reads runs.discovered_count, already
-- covered by subscribing to runs.

alter publication supabase_realtime add table run_events;
alter publication supabase_realtime add table tool_calls;
alter publication supabase_realtime add table leads;
alter publication supabase_realtime add table outreach_drafts;
alter publication supabase_realtime add table runs;
