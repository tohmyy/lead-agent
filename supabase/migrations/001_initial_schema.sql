-- AI Lead Research and Outreach Agent — initial schema.
--
-- Implements docs/data-model.md with two deliberate deviations, recorded in
-- the implementation plan's "Resolved Conflicts" table:
--   1. lead_sources references discovered_companies (not leads). Research
--      happens before qualification exists (data-model.md section 2.2's own
--      discovery -> research -> qualification ordering), so evidence can't
--      wait for a lead row.
--   2. leads.fit_reasons / leads.concerns / outreach_drafts.personalization_context
--      are structured JSONB (source_ids per claim) rather than plain
--      strings, so every qualification/outreach claim traces to evidence.
--
-- Users are Supabase Auth's built-in auth.users (data-model.md section 4).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type run_status as enum (
  'draft',
  'awaiting_icp_approval',
  'researching',
  'generating_outreach',
  'awaiting_review',
  'completed',
  'failed',
  'cancelled'
);

create type icp_source as enum ('agent', 'user');

create type qualification_status as enum (
  'qualified',
  'not_qualified',
  'needs_review'
);

create type review_state as enum (
  'not_reviewed',
  'reviewed',
  'edited',
  'approved_for_export'
);

create type source_type as enum (
  'homepage',
  'about',
  'product',
  'services',
  'pricing',
  'careers',
  'blog',
  'other'
);

create type outreach_channel as enum ('email', 'linkedin');

create type tool_call_status as enum ('pending', 'running', 'success', 'failed');

-- Canonical run_events vocabulary (data-model.md section 31 - the persisted
-- schema; the two tool-contract drafts disagreed with each other and with
-- this list, so this list wins).
create type run_event_type as enum (
  'run_created',
  'icp_refined',
  'icp_approved',
  'discovery_started',
  'discovery_completed',
  'company_research_started',
  'company_research_completed',
  'lead_qualified',
  'lead_rejected',
  'outreach_started',
  'outreach_completed',
  'run_completed',
  'run_failed',
  'run_cancelled'
);

-- ---------------------------------------------------------------------------
-- runs
-- ---------------------------------------------------------------------------

create table runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  objective text not null,
  status run_status not null default 'draft',
  qualified_target integer not null,
  discovery_limit integer not null,
  discovered_count integer not null default 0,
  qualified_count integer not null default 0,
  rejected_count integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint runs_qualified_target_positive check (qualified_target > 0),
  constraint runs_discovery_limit_positive check (discovery_limit > 0),
  constraint runs_discovery_limit_ge_target check (discovery_limit >= qualified_target),
  constraint runs_discovered_count_nonneg check (discovered_count >= 0),
  constraint runs_qualified_count_nonneg check (qualified_count >= 0),
  constraint runs_rejected_count_nonneg check (rejected_count >= 0),
  constraint runs_discovered_count_within_limit check (discovered_count <= discovery_limit)
);

create index runs_user_id_idx on runs (user_id);
create index runs_status_idx on runs (status);
create index runs_created_at_idx on runs (created_at);

-- ---------------------------------------------------------------------------
-- run_icps
-- ---------------------------------------------------------------------------

create table run_icps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs (id) on delete cascade,
  version integer not null,
  source icp_source not null,
  criteria jsonb not null,
  reasoning text,
  approved boolean not null default false,
  approved_at timestamptz,
  approved_by uuid references auth.users (id),
  created_at timestamptz not null default now(),

  constraint run_icps_version_positive check (version > 0),
  unique (run_id, version)
);

create index run_icps_run_id_idx on run_icps (run_id);

-- Only one approved ICP per run.
create unique index run_icps_one_approved_per_run
  on run_icps (run_id)
  where approved;

-- ---------------------------------------------------------------------------
-- discovered_companies
-- ---------------------------------------------------------------------------

create table discovered_companies (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs (id) on delete cascade,
  company_name text not null,
  domain text not null,
  normalized_domain text not null,
  discovery_source text not null default 'apify',
  source_url text,
  external_id text,
  raw_metadata jsonb,
  discovered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  unique (run_id, normalized_domain)
);

create index discovered_companies_run_id_idx on discovered_companies (run_id);
create index discovered_companies_run_domain_idx on discovered_companies (run_id, domain);

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------

create table leads (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs (id) on delete cascade,
  discovered_company_id uuid not null references discovered_companies (id) on delete cascade,
  company_name text not null,
  domain text not null,
  qualification_status qualification_status not null,
  confidence_score numeric,
  fit_reasons jsonb not null default '[]'::jsonb,
  concerns jsonb not null default '[]'::jsonb,
  qualification_reasoning text not null,
  source_summary text not null,
  research_metadata jsonb,
  review_state review_state not null default 'not_reviewed',
  qualified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint leads_confidence_range check (
    confidence_score is null or (confidence_score >= 0 and confidence_score <= 100)
  ),
  unique (run_id, discovered_company_id)
);

create index leads_run_id_idx on leads (run_id);
create index leads_run_status_idx on leads (run_id, qualification_status);
create index leads_run_confidence_idx on leads (run_id, confidence_score);

-- ---------------------------------------------------------------------------
-- lead_sources
--
-- Deliberately keyed to discovered_company_id, not lead_id (see header).
-- ---------------------------------------------------------------------------

create table lead_sources (
  id uuid primary key default gen_random_uuid(),
  discovered_company_id uuid not null references discovered_companies (id) on delete cascade,
  run_id uuid not null references runs (id) on delete cascade,
  url text not null,
  normalized_url text not null,
  title text,
  source_type source_type not null,
  summary text not null,
  relevant_excerpt text,
  scraped_at timestamptz not null default now(),
  provider text not null,
  metadata jsonb,
  created_at timestamptz not null default now(),

  unique (discovered_company_id, normalized_url)
);

create index lead_sources_company_idx on lead_sources (discovered_company_id);
create index lead_sources_run_idx on lead_sources (run_id);

-- ---------------------------------------------------------------------------
-- tool_calls
-- ---------------------------------------------------------------------------

create table tool_calls (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs (id) on delete cascade,
  tool_name text not null,
  purpose text not null,
  input_summary jsonb not null,
  result_summary jsonb,
  status tool_call_status not null default 'pending',
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms integer,
  external_reference text,
  created_at timestamptz not null default now()
);

create index tool_calls_run_id_idx on tool_calls (run_id);
create index tool_calls_run_status_idx on tool_calls (run_id, status);
create index tool_calls_created_at_idx on tool_calls (created_at);

-- ---------------------------------------------------------------------------
-- run_events
-- ---------------------------------------------------------------------------

create table run_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs (id) on delete cascade,
  event_type run_event_type not null,
  message text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index run_events_run_id_idx on run_events (run_id);
create index run_events_created_at_idx on run_events (created_at);

-- ---------------------------------------------------------------------------
-- outreach_drafts
-- ---------------------------------------------------------------------------

create table outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  run_id uuid not null references runs (id) on delete cascade,
  channel outreach_channel not null,
  step integer,
  subject text,
  body text not null,
  personalization_context jsonb not null default '{"claims":[]}'::jsonb,
  review_state review_state not null default 'not_reviewed',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint outreach_email_requires_step_and_subject check (
    (channel = 'email' and step in (1, 2, 3) and subject is not null)
    or (channel = 'linkedin' and step is null)
  ),
  unique (lead_id, channel, step, version)
);

create index outreach_drafts_lead_idx on outreach_drafts (lead_id);
create index outreach_drafts_lead_channel_idx on outreach_drafts (lead_id, channel);

-- ---------------------------------------------------------------------------
-- updated_at maintenance (data-model.md section 50: keep triggers minimal,
-- limited to bookkeeping — not business logic).
-- ---------------------------------------------------------------------------

create function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger runs_set_updated_at before update on runs
  for each row execute function set_updated_at();

create trigger leads_set_updated_at before update on leads
  for each row execute function set_updated_at();

create trigger outreach_drafts_set_updated_at before update on outreach_drafts
  for each row execute function set_updated_at();
