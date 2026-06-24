/**
 * STM live data client — calls the Supabase stm-proxy Edge Function.
 */
window.StmData = (function createStmData() {
  function config() {
    const base = window.STM_CONFIG || {};
    const local = window.STM_CONFIG_LOCAL || {};
    return {
      ...base,
      supabase: { ...base.supabase, ...local.supabase },
      feeds: { ...base.feeds, ...local.feeds },
      refreshMs: local.refreshMs ?? base.refreshMs
    };
  }

  function isConfigured() {
    const { url, anonKey, functionName } = config().supabase || {};
    return Boolean((url || "").trim() && (anonKey || "").trim() && (functionName || "").trim());
  }

  async function fetchFeed(feedKey) {
    if (!isConfigured()) {
      throw new Error("STM demo not configured");
    }

    const cfg = config();
    const feed = cfg.feeds?.[feedKey] || feedKey;
    const { url, anonKey, functionName } = cfg.supabase;
    const base = url.replace(/\/$/, "");
    const params = new URLSearchParams({ feed });
    const endpoint = `${base}/functions/v1/${functionName}?${params}`;

    const response = await fetch(endpoint, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`
      },
      cache: "no-store"
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `STM feed failed (${response.status})`);
    }

    return payload;
  }

  return {
    config,
    isConfigured,
    fetchServiceStatus() {
      return this.fetchFeed("serviceStatus");
    },
    fetchVehiclePositions() {
      return this.fetchFeed("vehiclePositions");
    },
    fetchTripUpdates() {
      return this.fetchFeed("tripUpdates");
    },
    fetchFeed
  };
})();
