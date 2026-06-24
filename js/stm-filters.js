/**
 * STM dashboard filter model — bus lines, load profile, and motion state.
 */
window.StmFilters = (function createStmFilters() {
  const LOAD_PROFILES = [
    { id: "all", label: "All loads", occupancy: null },
    { id: "light", label: "Light", occupancy: [0, 1] },
    { id: "moderate", label: "Moderate", occupancy: [2] },
    { id: "busy", label: "Busy", occupancy: [3, 4, 5] },
    { id: "unknown", label: "Unknown", occupancy: [6, 7, 8, null] }
  ];

  const MOTION_STATES = [
    { id: "all", label: "All motion" },
    { id: "moving", label: "In motion", minSpeed: 0.5 },
    { id: "stopped", label: "Stopped", maxSpeed: 0.5 }
  ];

  const LOAD_COLORS = {
    light: "#7CB342",
    moderate: "#F8C607",
    busy: "#E65100",
    unknown: "#9E9E9E"
  };

  function defaultState() {
    return {
      lines: new Set(),
      load: "all",
      motion: "all",
      lineSearch: ""
    };
  }

  function normalizeRouteId(routeId) {
    return String(routeId || "").trim();
  }

  function getLoadProfile(vehicle) {
    const code = vehicle?.occupancy;
    if (code === 0 || code === 1) return "light";
    if (code === 2) return "moderate";
    if (code === 3 || code === 4 || code === 5) return "busy";
    return "unknown";
  }

  function isMoving(vehicle, threshold = 0.5) {
    const speed = Number(vehicle?.speed);
    return Number.isFinite(speed) && speed >= threshold;
  }

  function matchesLoad(vehicle, loadId) {
    const profile = LOAD_PROFILES.find((item) => item.id === loadId) || LOAD_PROFILES[0];
    if (!profile.occupancy) return true;

    const code = vehicle?.occupancy ?? null;
    return profile.occupancy.some((value) => value === code);
  }

  function matchesMotion(vehicle, motionId) {
    const state = MOTION_STATES.find((item) => item.id === motionId) || MOTION_STATES[0];
    if (state.id === "all") return true;
    if (state.id === "moving") return isMoving(vehicle, state.minSpeed);
    return !isMoving(vehicle, state.maxSpeed);
  }

  function matchesLine(vehicle, selectedLines) {
    if (!selectedLines.size) return true;
    return selectedLines.has(normalizeRouteId(vehicle?.routeId));
  }

  function apply(vehicles, state) {
    const list = vehicles || [];
    return list.filter((vehicle) =>
      matchesLine(vehicle, state.lines)
      && matchesLoad(vehicle, state.load)
      && matchesMotion(vehicle, state.motion)
    );
  }

  function buildRouteIndex(vehicles) {
    const counts = new Map();

    (vehicles || []).forEach((vehicle) => {
      const routeId = normalizeRouteId(vehicle.routeId);
      if (!routeId) return;
      counts.set(routeId, (counts.get(routeId) || 0) + 1);
    });

    return [...counts.entries()]
      .map(([routeId, count]) => ({ routeId, count }))
      .sort((a, b) => b.count - a.count || a.routeId.localeCompare(b.routeId, undefined, { numeric: true }));
  }

  function filterRoutesForSearch(routes, query) {
    const needle = String(query || "").trim().toLowerCase();
    if (!needle) return routes;
    return routes.filter((route) => route.routeId.toLowerCase().includes(needle));
  }

  function summarizeAlerts(alerts, selectedLines) {
    const list = alerts || [];
    const filtered = list.filter((alert) => {
      if (!selectedLines.size) return true;
      const routes = extractAlertRoutes(alert);
      if (!routes.length) return true;
      return routes.some((routeId) => selectedLines.has(routeId));
    });

    return {
      total: list.length,
      filtered: filtered.length,
      items: filtered.slice(0, 14).map((alert, index) => formatAlert(alert, index))
    };
  }

  function extractAlertRoutes(alert) {
    const entities = alert?.informed_entities || [];
    return entities
      .map((entity) => normalizeRouteId(entity.route_short_name || entity.route_id))
      .filter(Boolean);
  }

  function pickLocalizedText(blocks) {
    if (!Array.isArray(blocks)) return "";
    const english = blocks.find((item) => item.language === "en" && item.text);
    const french = blocks.find((item) => item.language === "fr" && item.text);
    return String(english?.text || french?.text || blocks.find((item) => item.text)?.text || "");
  }

  function formatAlert(alert, index) {
    const routes = extractAlertRoutes(alert);
    const line = routes.length ? routes.join(", ") : `Alert ${index + 1}`;
    const header = pickLocalizedText(alert?.header_texts);
    const description = pickLocalizedText(alert?.description_texts);
    const state = description || header || alert?.effect || alert?.cause || "Service notice";
    const mode = alert?.informed_entities?.some((entity) => entity.stop_code)
      ? "Stop"
      : routes.length
        ? "Bus"
        : "Network";
    return { line, state: String(state), mode };
  }

  function loadColor(loadId) {
    return LOAD_COLORS[loadId] || LOAD_COLORS.unknown;
  }

  function vehicleMarkerColor(vehicle) {
    return loadColor(getLoadProfile(vehicle));
  }

  return {
    LOAD_PROFILES,
    MOTION_STATES,
    defaultState,
    apply,
    buildRouteIndex,
    filterRoutesForSearch,
    summarizeAlerts,
    getLoadProfile,
    vehicleMarkerColor,
    loadColor,
    isMoving
  };
})();
