-- Run once in Supabase SQL Editor (after scripts/supabase_study_permit_drafts.sql).
-- Blocks direct browser / anon / authenticated API access to study permit drafts.
-- Reads and writes go through the study-permit-kit Edge Function (service role) only.

alter table if exists public.study_permit_drafts enable row level security;

-- Drop any accidental policies that may have been added later.
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'study_permit_drafts'
  loop
    execute format('drop policy if exists %I on public.study_permit_drafts', pol.policyname);
  end loop;
end $$;

revoke all on table public.study_permit_drafts from anon, authenticated;
revoke all on table public.study_permit_drafts from public;

-- Keep service_role able to manage rows from Edge Functions.
grant select, insert, update, delete on table public.study_permit_drafts to service_role;

comment on table public.study_permit_drafts is
  'AES-GCM encrypted form payloads; resume keys hashed. No anon/authenticated grants — Edge Function (service role) only.';
