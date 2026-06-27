/**
 * STM dashboard filter model — lines, load, speed, delay, alerts, freshness.
 */
window.StmFilters = (function createStmFilters() {
  const LOAD_PROFILES = [
    { id: "all", label: "All loads", occupancy: null },
    { id: "light", label: "Light", occupancy: [0, 1] },
    { id: "moderate", label: "Moderate", occupancy: [2] },
    { id: "busy", label: "Busy", occupancy: [3, 4, 5] },
    { id: "unknown", label: "Unknown", occupancy: [6, 7, 8, null] }
  ];

  const SPEED_BANDS = [
    { id: "all", label: "All speeds" },
    { id: "slow", label: "Slow (<10 km/h)" },
    { id: "cruising", label: "Cruising (10–30)" },
    { id: "fast", label: "Fast (>30 km/h)" },
    { id: "unknown", label: "Unknown speed" }
  ];

  const DELAY_STATES = [
    { id: "all", label: "All delays" },
    { id: "on_time", label: "On time" },
    { id: "minor", label: "1–2 min late" },
    { id: "late", label: "2+ min late" },
    { id: "unknown", label: "No delay data" }
  ];

  const ALERT_FILTERS = [
    { id: "all", label: "All lines" },
    { id: "has_alert", label: "Lines with alerts" },
    { id: "detour", label: "Detours" },
    { id: "delay", label: "Delay notices" }
  ];

  const FRESHNESS_FILTERS = [
    { id: "all", label: "All positions" },
    { id: "fresh", label: "Fresh (<2 min)" },
    { id: "stale", label: "Stale (>2 min)" }
  ];

  const COLOR_MODES = [
    { id: "load", label: "Colour by load" },
    { id: "delay", label: "Colour by delay" }
  ];

  const LOAD_COLORS = {
    light: "#7CB342",
    moderate: "#F8C607",
    busy: "#E65100",
    unknown: "#9E9E9E"
  };

  const DELAY_COLORS = {
    on_time: "#43A047",
    minor: "#F8C607",
    late: "#E65100",
    unknown: "#9E9E9E"
  };

  function defaultState() {
    return {
      lines: new Set(),
      load: "all",
      speed: "all",
      delay: "all",
      alertFilter: "all",
      freshness: "all",
      colorMode: "load",
      lineSearch: "",
      direction: "all",
      accessibleOnly: false,
      linesWithAlertsOnly: false
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

  function matchesSpeed(vehicle, speedId) {
    if (speedId === "all") return true;
    return (vehicle?.speedBand || "unknown") === speedId;
  }

  function matchesDelay(vehicle, delayId) {
    if (delayId === "all") return true;
    if (vehicle?.isMetro) return delayId === "unknown";
    return (vehicle?.delayStatus || "unknown") === delayId;
  }

  function matchesFreshness(vehicle, freshnessId) {
    if (freshnessId === "all") return true;
    if (freshnessId === "fresh") return !vehicle?.isStale;
    return Boolean(vehicle?.isStale);
  }

  function matchesLine(vehicle, selectedLines) {
    if (!selectedLines.size) return true;
    return selectedLines.has(normalizeRouteId(vehicle?.routeId));
  }

  function categorizeAlert(alert) {
    const text = `${alert?.effect || ""} ${alert?.cause || ""} ${alertSummaryText(alert)}`.toLowerCase();
    if (/detour|détour|diversion|deviation|deviation/.test(text)) return "detour";
    if (/delay|retard|late|tard/.test(text)) return "delay";
    return "other";
  }

  function routeHasMatchingAlert(alerts, routeId, alertFilter) {
    if (alertFilter === "all") return true;
    const routeAlerts = alertsForRoute(alerts, routeId);
    if (!routeAlerts.length) return false;
    if (alertFilter === "has_alert") return true;
    return routeAlerts.some((alert) => categorizeAlert(alert) === alertFilter);
  }

  function apply(vehicles, state, options = {}) {
    const { alerts = [], includeMetro = true } = options;
    let list = vehicles || [];

    if (!includeMetro) {
      list = list.filter((vehicle) => !vehicle.isMetro);
    }

    if (state.linesWithAlertsOnly || (state.alertFilter !== "all" && !state.lines.size)) {
      list = list.filter((vehicle) => {
        const routeId = normalizeRouteId(vehicle.routeId);
        return routeHasMatchingAlert(alerts, routeId, state.linesWithAlertsOnly ? "has_alert" : state.alertFilter);
      });
    }

    return list.filter((vehicle) =>
      matchesLine(vehicle, state.lines)
      && matchesLoad(vehicle, state.load)
      && matchesSpeed(vehicle, state.speed)
      && matchesDelay(vehicle, state.delay)
      && matchesFreshness(vehicle, state.freshness)
    );
  }

  function buildRouteIndex(vehicles, options = {}) {
    const { alerts = [], meta = null, alertFilter = "all" } = options;
    const counts = new Map();

    (vehicles || []).forEach((vehicle) => {
      if (vehicle.isMetro) return;
      const routeId = normalizeRouteId(vehicle.routeId);
      if (!routeId) return;
      if (!routeHasMatchingAlert(alerts, routeId, alertFilter)) return;
      counts.set(routeId, (counts.get(routeId) || 0) + 1);
    });

    return [...counts.entries()]
      .map(([routeId, count]) => ({
        routeId,
        count,
        name: meta?.routes?.[routeId]?.name || null
      }))
      .sort((a, b) => b.count - a.count || a.routeId.localeCompare(b.routeId, undefined, { numeric: true }));
  }

  function filterRoutesForSearch(routes, query) {
    const needle = String(query || "").trim().toLowerCase();
    if (!needle) return routes;
    return routes.filter((route) =>
      route.routeId.toLowerCase().includes(needle)
      || String(route.name || "").toLowerCase().includes(needle)
    );
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
    return { line, state: String(state), mode: routes.length ? "Line" : "Network", header, description, routes };
  }

  function alertSummaryText(alert) {
    const header = pickLocalizedText(alert?.header_texts);
    const description = pickLocalizedText(alert?.description_texts);
    return String(description || header || alert?.effect || alert?.cause || "Service notice");
  }

  function alertsForRoute(alerts, routeId) {
    const target = normalizeRouteId(routeId);
    if (!target) return [];
    return (alerts || []).filter((alert) => {
      const routes = extractAlertRoutes(alert);
      return routes.includes(target);
    });
  }

  function buildStopAlertIndex(alerts, routeId, stops) {
    const stopAlerts = new Map();
    const routeAlerts = [];
    const stopByCode = new Map();

    (stops || []).forEach((stop) => {
      const code = String(stop.code || "").trim();
      if (code) stopByCode.set(code, stop);
    });

    alertsForRoute(alerts, routeId).forEach((alert) => {
      const text = alertSummaryText(alert);
      const entities = alert?.informed_entities || [];
      let matchedStop = false;

      entities.forEach((entity) => {
        const code = String(entity.stop_code || "").trim();
        if (!code) return;
        const stop = stopByCode.get(code);
        if (!stop) return;
        matchedStop = true;
        const key = stop.id || `${stop.lat},${stop.lng}`;
        const current = stopAlerts.get(key) || { stop, messages: [] };
        if (!current.messages.includes(text)) current.messages.push(text);
        stopAlerts.set(key, current);
      });

      if (!matchedStop) routeAlerts.push({ text, alert });
    });

    return { stopAlerts, routeAlerts };
  }

  function loadColor(loadId) {
    return LOAD_COLORS[loadId] || LOAD_COLORS.unknown;
  }

  function delayColor(status) {
    return DELAY_COLORS[status] || DELAY_COLORS.unknown;
  }

  function vehicleMarkerColor(vehicle, colorMode = "load") {
    if (colorMode === "delay") return delayColor(vehicle?.delayStatus || "unknown");
    return loadColor(getLoadProfile(vehicle));
  }

  function routeLabel(routeId, meta) {
    const name = meta?.routes?.[routeId]?.name;
    return name ? `Line ${routeId} · ${name}` : `Line ${routeId}`;
  }

  function filterShapesByDirection(shapes, direction) {
    const list = shapes || [];
    if (!direction || direction === "all") return list;
    return list.filter((shape) => {
      const headsign = typeof shape === "object" && shape.headsign
        ? shape.headsign
        : Array.isArray(shape) ? shape[0] : "";
      return String(headsign) === direction;
    });
  }

  function shapeOptions(route) {
    const shapes = route?.shapes || [];
    return shapes.map((shape) => {
      if (typeof shape === "object" && shape.headsign) return shape.headsign;
      if (Array.isArray(shape)) return shape[0];
      return "Direction";
    });
  }

  return {
    LOAD_PROFILES,
    SPEED_BANDS,
    DELAY_STATES,
    ALERT_FILTERS,
    FRESHNESS_FILTERS,
    COLOR_MODES,
    defaultState,
    apply,
    buildRouteIndex,
    filterRoutesForSearch,
    alertsForRoute,
    buildStopAlertIndex,
    alertSummaryText,
    categorizeAlert,
    routeHasMatchingAlert,
    getLoadProfile,
    vehicleMarkerColor,
    loadColor,
    delayColor,
    isMoving,
    routeLabel,
    filterShapesByDirection,
    shapeOptions
  };
})();
