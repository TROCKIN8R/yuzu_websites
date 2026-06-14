/**
 * Supabase read config — safe to commit (anon key + RLS SELECT only).
 * Settings → API: Project URL + anon public key.
 */
window.OPPORTUNITY_SUPABASE = {
  url: "https://mwgbeolcgigvpufjmodz.supabase.co",
  anonKey: "sb_publishable_PtrGVwhCJX4MJ5_Ic8TyGQ_m6qU41nl",
  table: "opportunities",
  intakeFunction: "opportunity-intake"
};
