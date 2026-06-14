-- Run once in Supabase SQL Editor.
-- Rate-limit buckets for the opportunity-intake Edge Function (service role only).

create table if not exists public.intake_rate_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  bucket text not null
);

create index if not exists intake_rate_events_bucket_created_idx
  on public.intake_rate_events (bucket, created_at desc);

alter table public.intake_rate_events enable row level security;

-- No SELECT/INSERT policies for anon or authenticated.
-- Edge Function uses the service role key to read/write this table.
