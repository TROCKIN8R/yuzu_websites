-- Refresh Watchdog demo — run in Supabase SQL Editor

create table if not exists public.refresh_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz not null default now(),
  pipeline text not null,
  duration_seconds integer not null,
  sla_minutes integer not null,
  status text not null default 'ok',
  scenario text not null default 'healthy',
  source text
);

alter table public.refresh_runs enable row level security;

create policy "Public read refresh runs"
  on public.refresh_runs
  for select
  to anon, authenticated
  using (true);

create index if not exists refresh_runs_started_at_idx
  on public.refresh_runs (started_at desc);

insert into public.refresh_runs (
  pipeline, duration_seconds, sla_minutes, status, scenario, source, started_at, completed_at
) values
  ('refresh_semantic_model', 248, 8, 'ok', 'healthy', 'supabase-seed', now() - interval '2 hours', now() - interval '2 hours'),
  ('sales_dwh_incremental', 732, 8, 'alert', 'breach', 'supabase-seed', now() - interval '45 minutes', now() - interval '45 minutes'),
  ('fabric_lakehouse_gold', 385, 20, 'ok', 'healthy', 'supabase-seed', now() - interval '20 minutes', now() - interval '20 minutes');
