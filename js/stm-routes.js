/**
 * Lazy loader for STM GTFS static route geometry, metro, and meta.
 */
window.StmRoutes = (function createStmRoutes() {
  const cache = new Map();
  let basePath = "../data/stm-routes";
  let dataPath = "../data";
  let metroCache = null;
  let metaCache = null;
  let headwaysCache = null;

  function setBasePath(path) {
    basePath = String(path || basePath).replace(/\/$/, "");
  }

  function setDataPath(path) {
    dataPath = String(path || dataPath).replace(/\/$/, "");
  }

  function safeRouteId(routeId) {
    return String(routeId || "").trim().replace(/\//g, "_");
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) return null;
    return response.json();
  }

  async function fetchRoute(routeId) {
    const key = safeRouteId(routeId);
    if (!key) return null;
    if (cache.has(key)) return cache.get(key);

    const request = fetch(`${basePath}/${encodeURIComponent(key)}.json`, { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = await response.json();
        cache.set(key, payload);
        return payload;
      })
      .catch(() => null);

    cache.set(key, request);
    return request;
  }

  async function fetchRoutes(routeIds) {
    const ids = [...new Set((routeIds || []).map(safeRouteId).filter(Boolean))];
    const results = await Promise.all(ids.map((id) => fetchRoute(id)));
    return results.filter(Boolean);
  }

  async function fetchMetro() {
    if (metroCache) return metroCache;
    metroCache = fetchJson(`${dataPath}/stm-metro.json`).catch(() => null);
    return metroCache;
  }

  async function fetchMeta() {
    if (metaCache) return metaCache;
    metaCache = fetchJson(`${dataPath}/stm-meta.json`).catch(() => null);
    return metaCache;
  }

  async function fetchHeadways() {
    if (headwaysCache) return headwaysCache;
    headwaysCache = fetchJson(`${dataPath}/stm-headways.json`).catch(() => null);
    return headwaysCache;
  }

  function normalizeShapes(route) {
    return (route?.shapes || []).map((shape) => {
      if (typeof shape === "object" && shape.points) {
        return { headsign: shape.headsign || "Direction", points: shape.points };
      }
      if (Array.isArray(shape)) {
        return { headsign: shape[0] || "Direction", points: shape[1] || [] };
      }
      return { headsign: "Direction", points: [] };
    });
  }

  function clearCache() {
    cache.clear();
    metroCache = null;
    metaCache = null;
    headwaysCache = null;
  }

  return {
    setBasePath,
    setDataPath,
    fetchRoute,
    fetchRoutes,
    fetchMetro,
    fetchMeta,
    fetchHeadways,
    normalizeShapes,
    clearCache
  };
})();
