-- Failure notifications: a minimal, dedicated table so "read" state stays
-- separate from run_events (an append-only history feed shared with the
-- Activity tab, not meant to carry per-user read/unread bookkeeping).
-- Rows are only ever written server-side via the service-role client
-- (RunOrchestrator.fail(), src/application/notifications/notification-service.ts)
-- — the anon-key role only ever reads/marks-read its own rows.

create type notification_type as enum ('run_failed');

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  run_id uuid references runs (id) on delete cascade,
  type notification_type not null,
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on notifications (user_id);
create index notifications_user_unread_idx on notifications (user_id) where read_at is null;
create index notifications_run_id_idx on notifications (run_id);

alter table notifications enable row level security;

create policy notifications_owner_select on notifications
  for select using (auth.uid() = user_id);
create policy notifications_owner_update on notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- No insert policy under the anon-key role, matching 002_row_level_security.sql's
-- rationale for run_events/tool_calls: writes only ever happen through
-- trusted server-side code using the service-role client.

alter publication supabase_realtime add table notifications;
