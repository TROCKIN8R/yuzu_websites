-- Yuzu opportunity tracker — run in Supabase SQL Editor
-- Project: create free project at https://supabase.com

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamptz not null default now(),
  name text not null,
  email_masked text,
  company text,
  domain text,
  company_size text,
  industry text,
  status text not null default 'pending',
  source_note text,
  source text
);

alter table public.opportunities enable row level security;

-- Public read for the live website table (publishable / anon key)
create policy "Public read opportunities"
  on public.opportunities
  for select
  to anon, authenticated
  using (true);

-- Website form inserts (publishable key) — status must be pending
create policy "Anon insert opportunities"
  on public.opportunities
  for insert
  to anon
  with check (
    char_length(trim(name)) between 1 and 120
    and email_masked is not null
    and status = 'pending'
  );

-- Zapier / server-side can still use the secret (service_role) key for enriched rows.

create index if not exists opportunities_submitted_at_idx
  on public.opportunities (submitted_at desc);

-- Optional demo row
insert into public.opportunities (
  name, email_masked, company, domain, company_size, industry, status, source_note, source
) values (
  'A*** M******',
  'a***@cascades.com',
  'Cascades',
  'cascades.com',
  'Enterprise (1,000+)',
  'Packaging & Paper',
  'researched',
  'Demo row — delete after going live',
  'supabase-seed'
);
