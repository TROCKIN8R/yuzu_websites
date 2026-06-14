# Opportunity form: email, captcha, and consent

The homepage form calls a Supabase Edge Function that:

1. Verifies consent and Cloudflare Turnstile (when configured)
2. Inserts a masked row into `opportunities`
3. Sends a personalized follow-up email via your Hostinger mailbox

SMTP and Turnstile secrets stay in Supabase, never in the public website.

## 1. Cloudflare Turnstile (captcha)

1. Open [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile) and create a widget for `yuzu.solutions`.
2. Copy the **site key** into `yuzu_github_page/js/opportunities-config.js`:

```javascript
window.OPPORTUNITY_CONFIG = {
  turnstile: {
    siteKey: "your-site-key"
  }
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

## 7. Hardening (required for production)

Run these once in the Supabase SQL Editor:

1. `scripts/supabase_revoke_anon_insert.sql` — blocks direct browser writes to `opportunities`
2. `scripts/supabase_intake_rate_limits.sql` — enables IP/email rate limiting in the Edge Function

The website form now submits **only** through `opportunity-intake`. There is no REST fallback.

The Edge Function also:
- Verifies Turnstile on every request
- Allows browser calls only from `yuzu.solutions`, GitHub Pages previews, and localhost
- Rate limits by IP (5/hour) and email (2/day) by default

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Captcha verification is required` | Set site + secret keys, redeploy function |
| `Consent is required` | Checkbox must be checked; payload must send `consent: true` |
| `emailSent: false`, `SMTP not configured` | Add all `SMTP_*` secrets and redeploy |
| SMTP auth failed | Confirm full email as username and mailbox password |
| Insert works, email fails | Check Hostinger sending limits; try port 587 |
| Function 404 | Run `supabase functions deploy opportunity-intake` |
| Direct REST insert works | Run `scripts/supabase_revoke_anon_insert.sql` |
| Rate limit errors | Wait for the window to expire, or tune `INTAKE_*` secrets |
