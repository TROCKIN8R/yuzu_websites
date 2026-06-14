-- Run once in Supabase SQL Editor if the table already exists.
-- Allows the website form to insert rows using the publishable (anon) key.

create policy "Anon insert opportunities"
  on public.opportunities
  for insert
  to anon
  with check (
    char_length(trim(name)) between 1 and 120
    and email_masked is not null
    and status = 'pending'
  );
