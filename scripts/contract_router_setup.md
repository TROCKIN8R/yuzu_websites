# Contract Router setup

## 1. Create the table

Run `scripts/supabase_contract_routes.sql` in the Supabase SQL Editor.

## 2. Deploy the edge function

Push to `main` (or run workflow manually). GitHub Actions deploys `contract-router` and reuses existing SMTP + Turnstile secrets.

## 3. Test locally

Open the homepage, switch to **Contract Router**, complete consent + captcha, submit name and email. You should see:

- A masked row in the live table with a **Routed to** destination
- Follow-up email to the submitter (with destination + Calendly link)
- Notify email to `adrienyvin@gmail.com` (override with `INTAKE_NOTIFY_EMAIL`)

## Optional env vars

| Variable | Default |
|----------|---------|
| `CONTRACT_ROUTES_TABLE` | `contract_routes` |
| `INTAKE_NOTIFY_EMAIL` | `adrienyvin@gmail.com` |
| `INTAKE_IP_LIMIT` | `5` |
| `INTAKE_EMAIL_LIMIT` | `2` |

Rate limits use separate `contract:ip:` / `contract:email:` buckets so they do not block the opportunity tracker.
