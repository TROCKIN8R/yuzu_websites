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
  status text not null default 'sent',
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

-- Inserts are Edge Function only (service role). Do not add anon INSERT policies.
-- To remove a legacy anon policy: scripts/supabase_revoke_anon_insert.sql

create index if not exists opportunities_submitted_at_idx
  on public.opportunities (submitted_at desc);

-- Optional demo row
insert into public.opportunities (
  name, email_masked, company, domain, company_size, industry, status, source_note, source
) values (
  'A*** M*****',
  'a***@cascades.com',
  'Cascades',
  'cascades.com',
  'Enterprise (1,000+)',
  'Packaging & Paper',
  'researched',
  'Demo row — delete after going live',
  'supabase-seed'
);
