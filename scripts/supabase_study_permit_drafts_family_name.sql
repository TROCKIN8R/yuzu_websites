-- Migrate existing study_permit_drafts from DOB+passport resume keys
-- to code + family name (last name).
-- Run in Supabase SQL Editor after deploying the updated Edge Function.
-- Existing drafts cannot be resumed under the new model (hashes differ).

alter table public.study_permit_drafts
  add column if not exists family_name_hash text;

drop index if exists public.study_permit_drafts_lookup_idx;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'study_permit_drafts'
      and column_name = 'dob_hash'
  ) then
    execute 'alter table public.study_permit_drafts alter column dob_hash drop not null';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'study_permit_drafts'
      and column_name = 'passport_hash'
  ) then
    execute 'alter table public.study_permit_drafts alter column passport_hash drop not null';
  end if;
end $$;

-- Remove rows that cannot be resumed under the new identity model
delete from public.study_permit_drafts
where family_name_hash is null;

alter table public.study_permit_drafts
  alter column family_name_hash set not null;

create index if not exists study_permit_drafts_lookup_idx
  on public.study_permit_drafts (code_hash, family_name_hash);

comment on table public.study_permit_drafts is
  'AES-GCM encrypted form payloads; resume via code + family name hashes. Drafts expire after 30 days. Service role only.';
