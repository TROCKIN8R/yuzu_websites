/**
 * Opportunity tracker config (public keys only).
 * SMTP and Turnstile secrets live in Supabase Edge Function secrets.
 */
window.OPPORTUNITY_CONFIG = {
  supabase: {
    url: "https://mwgbeolcgigvpufjmodz.supabase.co",
    anonKey: "sb_publishable_PtrGVwhCJX4MJ5_Ic8TyGQ_m6qU41nl",
    table: "opportunities",
    intakeFunction: "opportunity-intake"
  },
  turnstile: {
    siteKey: "0x4AAAAAADkvLG6-bWbBy8DY"
  },
  fieldLimits: {
    name: 120,
    email: 254
  }
};
