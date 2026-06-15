-- Contract Router demo — safe to re-run in Supabase SQL Editor

create table if not exists public.contract_routes (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamptz not null default now(),
  name text not null,
  email_masked text,
  company text,
  domain text,
  destination text not null,
  status text not null default 'pending',
  signed_at timestamptz,
  source text
);

-- Add columns / defaults when upgrading an existing table
alter table public.contract_routes
  add column if not exists signed_at timestamptz;

alter table public.contract_routes
  alter column status set default 'pending';

alter table public.contract_routes enable row level security;

drop policy if exists "Public read contract routes" on public.contract_routes;

create policy "Public read contract routes"
  on public.contract_routes
  for select
  to anon, authenticated
  using (true);

create index if not exists contract_routes_submitted_at_idx
  on public.contract_routes (submitted_at desc);

-- Optional demo rows (refreshed on each run)
delete from public.contract_routes
where source = 'supabase-seed';

insert into public.contract_routes (
  name, email_masked, company, domain, destination, status, source, submitted_at, signed_at
) values
  ('J*** S*****', 'j***@acmecorp.com', 'Acmecorp', 'acmecorp.com', 'SharePoint / Legal', 'signed', 'supabase-seed', now() - interval '3 hours', now() - interval '2 hours 45 minutes'),
  ('M*** L**', 'm***@gmail.com', 'Personal inbox', 'gmail.com', 'SharePoint / Internal', 'pending', 'supabase-seed', now() - interval '90 minutes', null);
