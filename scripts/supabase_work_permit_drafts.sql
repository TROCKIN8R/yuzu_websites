-- Run once in Supabase SQL Editor.
-- Draft saves for the work-permit kit (service role only).

create table if not exists public.work_permit_drafts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  code_hash text not null unique,
  family_name_hash text not null,
  step integer not null default 0,
  payload jsonb not null
);

create index if not exists work_permit_drafts_expires_at_idx
  on public.work_permit_drafts (expires_at);

create index if not exists work_permit_drafts_lookup_idx
  on public.work_permit_drafts (code_hash, family_name_hash);

alter table public.work_permit_drafts enable row level security;

comment on table public.work_permit_drafts is
  'AES-GCM encrypted work-permit kit payloads; resume via code + family name hashes.';
