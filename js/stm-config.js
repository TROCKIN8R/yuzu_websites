/**
 * STM live demo — public config only.
 * Never put your STM API key here. It lives in Supabase Edge Function secrets.
 *
 * Setup: scripts/stm_setup.md
 */
window.STM_CONFIG = {
  supabase: {
    url: "https://mwgbeolcgigvpufjmodz.supabase.co",
    anonKey: "sb_publishable_PtrGVwhCJX4MJ5_Ic8TyGQ_m6qU41nl",
    functionName: "stm-proxy"
  },
  feeds: {
    serviceStatus: "serviceStatus",
    vehiclePositions: "vehiclePositions",
    tripUpdates: "tripUpdates"
  },
  refreshMs: 30000
};
