# Contract Router setup

## 1. Create or migrate the table

**New project:** run `scripts/supabase_contract_routes.sql` in the Supabase SQL Editor.

**Existing table:** also run `scripts/supabase_contract_routes_signing.sql` to add `signed_at` and switch the default status to `pending`.

## 2. Deploy the edge function

Push to `main` (or run workflow manually). GitHub Actions deploys `contract-router` and reuses existing SMTP + Turnstile secrets.

## 3. Test the flow

1. Open the homepage **Contract Router** tab, complete consent + captcha, submit name and email.
2. Check your inbox for a **Signature requested** email with a mock Services Agreement and **Sign here** button.
3. Click **Sign here** — you land on `contract-sign.html` with a branded confirmation, receive a thanks email, and the live table row updates to **Signed**.

## Optional env vars

| Variable | Default |
|----------|---------|
| `CONTRACT_ROUTES_TABLE` | `contract_routes` |
| `CONTRACT_SIGNING_SECRET` | `SUPABASE_SERVICE_ROLE_KEY` |
| `INTAKE_NOTIFY_EMAIL` | `adrienyvin@gmail.com` |
| `INTAKE_IP_LIMIT` | `5` |
| `INTAKE_EMAIL_LIMIT` | `2` |

Rate limits use separate `contract:ip:` / `contract:email:` buckets so they do not block the opportunity tracker.

Sign links expire after 7 days.
