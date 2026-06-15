# Refresh Watchdog demo setup

## 1. Create the table

Run `scripts/supabase_refresh_runs.sql` in the Supabase SQL Editor.

This creates the public `refresh_runs` table (read-only for anon) and optional seed rows.

## 2. Deploy the Edge Function

Push to `main` (GitHub Actions deploys `refresh-watchdog`) or run:

```bash
export SUPABASE_ACCESS_TOKEN='your-token'
supabase functions deploy refresh-watchdog --project-ref mwgbeolcgigvpufjmodz
```

Uses the same SMTP and Turnstile secrets as `opportunity-intake`.

## 3. Demo behavior

- **Run healthy refresh**: inserts a ~3–4 min run within SLA
- **Simulate SLA breach**: inserts a ~10–15 min run over the SLA and emails `adrienyvin@gmail.com` (Slack stand-in)

Public table on the homepage shows the latest 5 runs.
