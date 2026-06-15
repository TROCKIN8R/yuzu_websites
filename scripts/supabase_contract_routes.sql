-- Contract Router demo — run in Supabase SQL Editor

create table if not exists public.contract_routes (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamptz not null default now(),
  name text not null,
  email_masked text,
  company text,
  domain text,
  destination text not null,
  status text not null default 'routed',
  source text
);

alter table public.contract_routes enable row level security;

create policy "Public read contract routes"
  on public.contract_routes
  for select
  to anon, authenticated
  using (true);

create index if not exists contract_routes_submitted_at_idx
  on public.contract_routes (submitted_at desc);

insert into public.contract_routes (
  name, email_masked, company, domain, destination, status, source, submitted_at
) values
  ('J*** S*****', 'j***@acmecorp.com', 'Acmecorp', 'acmecorp.com', 'SharePoint / Legal', 'routed', 'supabase-seed', now() - interval '3 hours'),
  ('M*** L**', 'm***@gmail.com', 'Personal inbox', 'gmail.com', 'SharePoint / Internal', 'routed', 'supabase-seed', now() - interval '90 minutes');
