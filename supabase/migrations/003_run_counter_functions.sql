-- Atomic counter operations for runs. These exist so concurrent tool calls
-- can never jointly exceed discovery_limit — TEST-PLAN.md LIMIT-005 requires
-- this be enforced atomically, not via a read-then-write race in application
-- code. Each function body executes as a single Postgres statement/lock
-- scope, so two concurrent RPC calls serialize correctly.

create or replace function reserve_discovery_slots(p_run_id uuid, p_count integer)
returns integer
language plpgsql
as $$
declare
  v_limit integer;
  v_current integer;
  v_reserved integer;
begin
  select discovery_limit, discovered_count into v_limit, v_current
  from runs
  where id = p_run_id
  for update;

  if not found then
    raise exception 'run % not found', p_run_id;
  end if;

  v_reserved := greatest(least(p_count, v_limit - v_current), 0);

  update runs
  set discovered_count = discovered_count + v_reserved
  where id = p_run_id;

  return v_reserved;
end;
$$;

-- Reconciles discovered_count back down when a reserved batch of discovery
-- slots produced fewer *new, unique* companies than were reserved (e.g. the
-- provider returned duplicates or fewer results than requested). Keeps
-- discovered_count meaning "unique discovered companies"
-- (data-model.md section 15) while reserve_discovery_slots above still
-- prevents concurrent over-commit during the async provider call.
create or replace function release_discovery_slots(p_run_id uuid, p_count integer)
returns void
language sql
as $$
  update runs
  set discovered_count = greatest(discovered_count - p_count, 0)
  where id = p_run_id;
$$;

create or replace function increment_run_counts(
  p_run_id uuid,
  p_qualified_delta integer,
  p_rejected_delta integer
)
returns void
language sql
as $$
  update runs
  set qualified_count = qualified_count + p_qualified_delta,
      rejected_count = rejected_count + p_rejected_delta
  where id = p_run_id;
$$;
