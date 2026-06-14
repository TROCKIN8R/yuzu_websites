# Opportunity form: email, captcha, and consent

The homepage form calls a Supabase Edge Function that:

1. Verifies consent and Cloudflare Turnstile (when configured)
2. Inserts a masked row into `opportunities`
3. Sends a personalized follow-up email via your Hostinger mailbox

SMTP and Turnstile secrets stay in Supabase, never in the public website.

## 1. Cloudflare Turnstile (captcha)

1. Open [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile) and create a widget for `yuzu.solutions`.
2. Copy the **site key** into `yuzu_github_page/js/opportunities-turnstile-config.js`:

```javascript
window.OPPORTUNITY_TURNSTILE = {
  siteKey: "your-site-key"
};
```

3. Add the **secret key** in Supabase → Edge Functions → Secrets:

```
TURNSTILE_SECRET_KEY=your-secret-key
```

For local testing only, Cloudflare provides always-pass test keys:

```
site: 1x00000000000000000000AA
secret: 1x0000000000000000000000000000000AA
```

If `siteKey` is empty, the widget is hidden and captcha is skipped until you configure keys.

## 2. Hostinger mailbox details

In **Hostinger → Emails**, open your mailbox (`info@yuzu.solutions`) and note:

| Setting | Typical value |
| --- | --- |
| SMTP host | `smtp.hostinger.com` |
| SMTP port | `465` (SSL) or `587` (TLS) |
| Username | Full email address |
| Password | Mailbox password |

If port `465` fails from Supabase, try `587` with `SMTP_SECURE=false`.

## 3. Supabase secrets

In **Supabase Dashboard → Project Settings → Edge Functions → Secrets**, add:

```
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=info@yuzu.solutions
SMTP_PASS=your-mailbox-password
SMTP_FROM=info@yuzu.solutions
TURNSTILE_SECRET_KEY=your-turnstile-secret-key
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically for Edge Functions.

## 4. Deploy the function

Install the [Supabase CLI](https://supabase.com/docs/guides/cli), log in, and link the project:

```bash
cd /path/to/yuzu_websites
supabase login
supabase link --project-ref mwgbeolcgigvpufjmodz
supabase functions deploy opportunity-intake
```

`verify_jwt` is disabled in `supabase/config.toml` so the public form can call the function with the publishable key.

## 5. Test

```bash
curl -s -X POST "https://mwgbeolcgigvpufjmodz.supabase.co/functions/v1/opportunity-intake" \
  -H "apikey: YOUR_PUBLISHABLE_KEY" \
  -H "Authorization: Bearer YOUR_PUBLISHABLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"you@yourdomain.com","source":"manual-test","consent":true,"captchaToken":"test-token"}'
```

With Turnstile enabled, use a real token from the form widget or Cloudflare test secret.

## 6. Consent

The form requires an explicit checkbox before submit. The Edge Function rejects requests where `consent` is not `true`.

## 7. Fallback behavior

If the Edge Function is not deployed yet, the form falls back to a direct Supabase insert (table only, no email).

Once deployed with SMTP secrets, users see: *"Check your inbox for a follow-up with a Calendly link."*

If Turnstile is configured, direct REST fallback is disabled and all submissions must pass the Edge Function.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Captcha verification is required` | Set site + secret keys, redeploy function |
| `Consent is required` | Checkbox must be checked; payload must send `consent: true` |
| `emailSent: false`, `SMTP not configured` | Add all `SMTP_*` secrets and redeploy |
| SMTP auth failed | Confirm full email as username and mailbox password |
| Insert works, email fails | Check Hostinger sending limits; try port 587 |
| Function 404 | Run `supabase functions deploy opportunity-intake` |
| Row not inserted | Run `scripts/supabase_anon_insert_policy.sql` if using REST fallback only |
