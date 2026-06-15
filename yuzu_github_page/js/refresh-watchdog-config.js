/**
 * Refresh Watchdog demo config (public keys only).
 */
window.REFRESH_WATCHDOG_CONFIG = {
  supabase: {
    url: "https://mwgbeolcgigvpufjmodz.supabase.co",
    anonKey: "sb_publishable_PtrGVwhCJX4MJ5_Ic8TyGQ_m6qU41nl",
    table: "refresh_runs",
    functionName: "refresh-watchdog"
  },
  turnstile: {
    siteKey: "0x4AAAAAADkvLG6-bWbBy8DY"
  },
  defaultSlaMinutes: 8,
  pipelines: [
    { id: "refresh_semantic_model", label: "Semantic model refresh", slaDefault: 8 },
    { id: "sales_dwh_incremental", label: "Sales DWH incremental", slaDefault: 15 },
    { id: "fabric_lakehouse_gold", label: "Fabric lakehouse Gold layer", slaDefault: 20 }
  ]
};
