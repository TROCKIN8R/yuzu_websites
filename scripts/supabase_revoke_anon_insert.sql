-- Run once in Supabase SQL Editor.
-- Removes public browser writes; inserts go through opportunity-intake Edge Function only.

drop policy if exists "Anon insert opportunities" on public.opportunities;
