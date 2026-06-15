-- Contract Router signing migration — safe to re-run if you already created contract_routes

alter table public.contract_routes
  add column if not exists signed_at timestamptz;

alter table public.contract_routes
  alter column status set default 'pending';

update public.contract_routes
set status = 'pending'
where status = 'routed' and signed_at is null;
