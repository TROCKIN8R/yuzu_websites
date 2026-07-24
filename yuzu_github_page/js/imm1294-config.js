/**
 * IMM 1294 filler demo config (public keys only).
 * SMTP and Turnstile secrets live in Supabase Edge Function secrets.
 */
window.IMM1294_CONFIG = {
  supabase: {
    url: "https://mwgbeolcgigvpufjmodz.supabase.co",
    anonKey: "sb_publishable_PtrGVwhCJX4MJ5_Ic8TyGQ_m6qU41nl",
    fillFunction: "imm1294-filler"
  },
  turnstile: {
    siteKey: "0x4AAAAAADkvLG6-bWbBy8DY"
  }
};
