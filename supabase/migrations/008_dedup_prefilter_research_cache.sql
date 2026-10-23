-- In-run identity: the same LinkedIn company id must not become two rows.
-- Name collapse stays application-level (two real Acmes can exist).
create unique index if not exists discovered_companies_run_external_id_uidx
  on discovered_companies (run_id, external_id)
  where external_id is not null;

alter table discovered_companies
  add column if not exists normalized_name text;

update discovered_companies
  set normalized_name = lower(regexp_replace(trim(company_name), '\s+', ' ', 'g'))
  where normalized_name is null;

alter table discovered_companies
  alter column normalized_name set not null;

create index if not exists discovered_companies_run_normalized_name_idx
  on discovered_companies (run_id, normalized_name);

-- Failed website research is a first-class activity event so a scrape miss
-- does not leave a dangling company_research_started in the feed.
alter type run_event_type add value if not exists 'company_research_failed';

-- Cross-run cache of public page text. Service-role only (no user_id):
-- this is scraped public website content, reused so the same domain is
-- not Firecrawl'd again in a later run.
create table if not exists website_research_cache (
  id uuid primary key default gen_random_uuid(),
  normalized_domain text not null,
  normalized_url text not null,
  title text,
  source_type text not null,
  summary text not null,
  relevant_excerpt text,
  provider text not null,
  fetched_at timestamptz not null default now(),
  unique (normalized_domain, normalized_url)
);

create index if not exists website_research_cache_domain_idx
  on website_research_cache (normalized_domain, fetched_at desc);

create table if not exists website_research_failures (
  normalized_domain text primary key,
  error_message text not null,
  failed_at timestamptz not null default now()
);

alter table website_research_cache enable row level security;
alter table website_research_failures enable row level security;
-- No anon-key policies: reads and writes go through the service-role client.
