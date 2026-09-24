-- Row Level Security: users may only ever see records belonging to runs
-- they own (data-model.md section 48, AGENTS.md section 24-25).
--
-- Application server code normally uses the service-role client (which
-- bypasses RLS) and performs its own explicit ownership checks — see
-- src/infrastructure/supabase/service-role-client.ts. These policies are
-- the defense-in-depth layer for anything reached through the anon-key
-- session client (Server Components reading data for the signed-in user,
-- and any future direct client access).

alter table runs enable row level security;
alter table run_icps enable row level security;
alter table discovered_companies enable row level security;
alter table leads enable row level security;
alter table lead_sources enable row level security;
alter table tool_calls enable row level security;
alter table run_events enable row level security;
alter table outreach_drafts enable row level security;

create policy runs_owner_select on runs
  for select using (auth.uid() = user_id);
create policy runs_owner_insert on runs
  for insert with check (auth.uid() = user_id);
create policy runs_owner_update on runs
  for update using (auth.uid() = user_id);

create policy run_icps_owner_select on run_icps
  for select using (
    exists (select 1 from runs where runs.id = run_icps.run_id and runs.user_id = auth.uid())
  );
create policy run_icps_owner_write on run_icps
  for insert with check (
    exists (select 1 from runs where runs.id = run_icps.run_id and runs.user_id = auth.uid())
  );
create policy run_icps_owner_update on run_icps
  for update using (
    exists (select 1 from runs where runs.id = run_icps.run_id and runs.user_id = auth.uid())
  );

create policy discovered_companies_owner_select on discovered_companies
  for select using (
    exists (select 1 from runs where runs.id = discovered_companies.run_id and runs.user_id = auth.uid())
  );

create policy leads_owner_select on leads
  for select using (
    exists (select 1 from runs where runs.id = leads.run_id and runs.user_id = auth.uid())
  );
create policy leads_owner_update on leads
  for update using (
    exists (select 1 from runs where runs.id = leads.run_id and runs.user_id = auth.uid())
  );

create policy lead_sources_owner_select on lead_sources
  for select using (
    exists (select 1 from runs where runs.id = lead_sources.run_id and runs.user_id = auth.uid())
  );

create policy tool_calls_owner_select on tool_calls
  for select using (
    exists (select 1 from runs where runs.id = tool_calls.run_id and runs.user_id = auth.uid())
  );

create policy run_events_owner_select on run_events
  for select using (
    exists (select 1 from runs where runs.id = run_events.run_id and runs.user_id = auth.uid())
  );

create policy outreach_drafts_owner_select on outreach_drafts
  for select using (
    exists (select 1 from runs where runs.id = outreach_drafts.run_id and runs.user_id = auth.uid())
  );
create policy outreach_drafts_owner_update on outreach_drafts
  for update using (
    exists (select 1 from runs where runs.id = outreach_drafts.run_id and runs.user_id = auth.uid())
  );

-- No insert/delete policies are defined for discovered_companies, leads
-- (insert), lead_sources, tool_calls, run_events, or outreach_drafts
-- (insert) under the anon-key role: those writes only ever happen through
-- trusted server-side application code using the service-role client,
-- which bypasses RLS entirely and performs its own ownership checks. This
-- is deliberate — it prevents a browser client from ever writing directly
-- into audit/evidence tables.
