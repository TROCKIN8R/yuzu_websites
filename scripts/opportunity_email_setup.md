# Opportunity form follow-up email (Hostinger SMTP)

The homepage form calls a Supabase Edge Function that:

1. Inserts a masked row into `opportunities`
2. Sends a personalized follow-up email via your Hostinger mailbox

SMTP credentials stay in Supabase secrets, never in the public website.

## 1. Hostinger mailbox details

In **Hostinger → Emails**, open your mailbox (`info@yuzu.solutions`) and note:

| Setting | Typical value |
| --- | --- |
| SMTP host | `smtp.hostinger.com` |
| SMTP port | `465` (SSL) or `587` (TLS) |
| Username | Full email address |
| Password | Mailbox password |

If port `465` fails from Supabase, try `587` with `SMTP_SECURE=false`.

## 2. Supabase secrets

In **Supabase Dashboard → Project Settings → Edge Functions → Secrets**, add:

```
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=info@yuzu.solutions
SMTP_PASS=your-mailbox-password
SMTP_FROM=info@yuzu.solutions
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically for Edge Functions.

## 3. Deploy the function

Install the [Supabase CLI](https://supabase.com/docs/guides/cli), log in, and link the project:

```bash
cd /path/to/yuzu_websites
supabase login
supabase link --project-ref mwgbeolcgigvpufjmodz
supabase functions deploy opportunity-intake
```

`verify_jwt` is disabled in `supabase/config.toml` so the public form can call the function with the publishable key.

## 4. Test

```bash
curl -s -X POST "https://mwgbeolcgigvpufjmodz.supabase.co/functions/v1/opportunity-intake" \
  -H "apikey: YOUR_PUBLISHABLE_KEY" \
  -H "Authorization: Bearer YOUR_PUBLISHABLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"you@yourdomain.com","source":"manual-test"}'
```

Expected response:

```json
{ "ok": true, "row": { ... }, "emailSent": true, "emailError": null }
```

Then submit the form on the homepage and confirm the row appears plus the inbox receives the follow-up.

## 5. Fallback behavior

If the Edge Function is not deployed yet, the form falls back to a direct Supabase insert (table only, no email).

Once deployed with SMTP secrets, users see: *"Check your inbox for a follow-up with a Calendly link."*

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `emailSent: false`, `SMTP not configured` | Add all `SMTP_*` secrets and redeploy |
| SMTP auth failed | Confirm full email as username and mailbox password |
| Insert works, email fails | Check Hostinger sending limits; try port 587 |
| Function 404 | Run `supabase functions deploy opportunity-intake` |
| Row not inserted | Run `scripts/supabase_anon_insert_policy.sql` if using REST fallback only |
