/**
 * Contract Router config (public keys only).
 * SMTP and Turnstile secrets live in Supabase Edge Function secrets.
 */
window.CONTRACT_ROUTER_CONFIG = {
  supabase: {
    url: "https://mwgbeolcgigvpufjmodz.supabase.co",
    anonKey: "sb_publishable_PtrGVwhCJX4MJ5_Ic8TyGQ_m6qU41nl",
    table: "contract_routes",
    intakeFunction: "contract-router"
  },
  turnstile: {
    siteKey: "0x4AAAAAADkvLG6-bWbBy8DY"
  },
  fieldLimits: {
    name: 120,
    email: 254
  }
};
