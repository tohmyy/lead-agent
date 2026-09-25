-- Operator workflow: recorded spend and per-filter qualification verdicts.
-- Costs are accumulated with an atomic add so concurrent discovery calls
-- cannot lose an update. Deltas must be non-negative; the columns themselves
-- cannot go below zero.

alter table runs
  add column discovery_cost_usd numeric not null default 0,
  add column agent_cost_usd numeric not null default 0;

alter table runs
  add constraint runs_discovery_cost_nonneg check (discovery_cost_usd >= 0),
  add constraint runs_agent_cost_nonneg check (agent_cost_usd >= 0);

alter table leads
  add column hard_filter_results jsonb not null default '[]'::jsonb;

create or replace function add_run_cost(
  p_run_id uuid,
  p_discovery_usd numeric,
  p_agent_usd numeric
)
returns void
language plpgsql
as $$
begin
  if p_discovery_usd < 0 or p_agent_usd < 0 then
    raise exception 'cost deltas must be non-negative';
  end if;

  update runs
  set discovery_cost_usd = discovery_cost_usd + p_discovery_usd,
      agent_cost_usd = agent_cost_usd + p_agent_usd
  where id = p_run_id;
end;
$$;
