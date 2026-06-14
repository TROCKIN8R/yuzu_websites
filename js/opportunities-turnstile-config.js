/**
 * Cloudflare Turnstile site key (public, safe to commit).
 * Create keys at: https://dash.cloudflare.com/?to=/:account/turnstile
 * Add the secret key as TURNSTILE_SECRET_KEY in Supabase Edge Function secrets.
 *
 * For local testing only, Cloudflare provides always-pass test keys:
 * site: 1x00000000000000000000AA
 * secret: 1x0000000000000000000000000000000AA
 */
window.OPPORTUNITY_TURNSTILE = {
  siteKey: "0x4AAAAAADkvLG6-bWbBy8DY"
};
