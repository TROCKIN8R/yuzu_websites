-- Run once in Supabase SQL Editor.
-- Draft saves for the study-permit kit demo (service role only).
-- Resume requires secret code + date of birth + passport number (hashes stored).
-- Form answers are AES-256-GCM encrypted in payload (Edge Function encrypts/decrypts).
-- Also run: scripts/supabase_revoke_study_permit_drafts.sql

create table if not exists public.study_permit_drafts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  code_hash text not null unique,
  dob_hash text not null,
  passport_hash text not null,
  step integer not null default 0,
  -- Encrypted envelope JSON: { enc:true, v:1, alg:"AES-GCM", iv:"...", data:"..." }
  payload jsonb not null
);

create index if not exists study_permit_drafts_expires_at_idx
  on public.study_permit_drafts (expires_at);

create index if not exists study_permit_drafts_lookup_idx
  on public.study_permit_drafts (code_hash, dob_hash, passport_hash);

alter table public.study_permit_drafts enable row level security;

-- No SELECT/INSERT/UPDATE/DELETE policies for anon or authenticated.
-- Edge Function uses the service role key to read/write this table.
-- Harden further with scripts/supabase_revoke_study_permit_drafts.sql

comment on table public.study_permit_drafts is
  'AES-GCM encrypted form payloads; resume keys hashed. Demo drafts expire after 30 days. Service role only.';
