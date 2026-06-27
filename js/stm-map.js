/**
 * Montreal map — metro lines, bus routes, vehicles with bearing and delay colours.
 */
window.StmMap = (function createStmMap() {
  let map = null;
  let metroLineLayer = null;
  let metroTrainLayer = null;
  let routeLayer = null;
  let stopLayer = null;
  let alertLayer = null;
  let markerLayer = null;
  let ready = false;
  let lastBoundsKey = "";
  let selectedVehicleId = null;
  let onVehicleSelect = null;
  let metroDrawn = false;

  const BUS_ROUTE_COLORS = ["#1565C0", "#6A1B9A", "#00838F", "#EF6C00"];
  const ROUTE_WEIGHT = 4;
  const METRO_WEIGHT = 5;

  function init(containerId) {
    if (map || !window.L) return map;
    const el = document.getElementById(containerId);
    if (!el) return null;

    map = L.map(el, {
      center: [45.55, -73.62],
      zoom: 11,
      minZoom: 10,
      maxZoom: 16,
      scrollWheelZoom: true
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OSM &copy; CARTO",
      subdomains: "abcd",
      maxZoom: 19
    }).addTo(map);

    metroLineLayer = L.layerGroup().addTo(map);
    metroTrainLayer = L.layerGroup().addTo(map);
    routeLayer = L.layerGroup().addTo(map);
    stopLayer = L.layerGroup().addTo(map);
    alertLayer = L.layerGroup().addTo(map);
    markerLayer = L.layerGroup().addTo(map);
    ready = true;
    return map;
  }

  function ensureReady(containerId) {
    if (!ready) init(containerId);
    return ready;
  }

  function invalidate() {
    if (!map) return;
    window.requestAnimationFrame(() => map.invalidateSize({ animate: false }));
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function formatSpeed(speed) {
    const value = Number(speed);
    if (!Number.isFinite(value)) return "—";
    return `${Math.round(value * 3.6)} km/h`;
  }

  function formatDelay(seconds) {
    const value = Math.max(0, Math.round(Number(seconds) || 0));
    if (!value) return "On time";
    if (value < 60) return `${value}s late`;
    const minutes = Math.floor(value / 60);
    const remainder = value % 60;
    return remainder ? `${minutes}m ${remainder}s late` : `${minutes}m late`;
  }

  function formatAge(seconds) {
    const value = Math.round(Number(seconds) || 0);
    if (value < 60) return `${value}s ago`;
    return `${Math.floor(value / 60)}m ago`;
  }

  function normalizeColor(color, fallback) {
    const raw = String(color || "").trim();
    if (!raw) return fallback;
    return raw.startsWith("#") ? raw : `#${raw}`;
  }

  function createVehicleIcon(vehicle, options) {
    const { fillColor, isSelected, isMetro, bearing } = options;
    const size = isSelected ? 16 : isMetro ? 14 : 12;
    const border = isSelected ? "#1565C0" : isMetro ? "#37474F" : "#2D3436";
    const rotation = Number.isFinite(Number(bearing)) ? Number(bearing) : 0;
    const className = isMetro ? "stm-vehicle-icon stm-vehicle-icon--metro" : "stm-vehicle-icon stm-vehicle-icon--bus";

    return L.divIcon({
      className,
      html: `<span style="transform:rotate(${rotation}deg);background:${fillColor};border-color:${border}"></span>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
  }

  function buildVehiclePopup(vehicle, filters, meta, headways) {
    const routeId = vehicle.routeId || "—";
    const routeName = meta?.routes?.[routeId]?.name;
    const route = routeName ? `Line ${routeId} · ${routeName}` : `Line ${routeId}`;
    const load = filters?.getLoadProfile?.(vehicle) || "unknown";
    const occupancy = vehicle.occupancyLabel
      ? vehicle.occupancyLabel.replace(/_/g, " ")
      : load;
    const headway = headways?.routes?.[routeId]?.avgHeadwayMin || vehicle.avgHeadwayMin;

    return `
      <div class="stm-popup">
        <strong>${escapeHtml(route)}</strong>
        <div>${vehicle.isMetro ? "Metro train" : `Vehicle ${escapeHtml(vehicle.id || "—")}`}</div>
        <div>Load: ${escapeHtml(occupancy)}</div>
        <div>Delay: ${escapeHtml(formatDelay(vehicle.delay))}</div>
        <div>${vehicle.isStale ? "Stale position" : "Fresh position"} · ${formatAge(vehicle.ageSec)}</div>
        <div>${formatSpeed(vehicle.speed)} · ${vehicle.isMetro ? "Metro" : filters?.isMoving?.(vehicle) ? "In motion" : "Stopped"}</div>
        ${headway ? `<div>Scheduled avg headway: ${headway} min</div>` : ""}
        ${vehicle.isMetro ? "" : `<div class="stm-popup__hint">Click to show line path</div>`}
      </div>
    `;
  }

  function buildStopPopup(stop, alertMessages, headwayMin) {
    const alerts = (alertMessages || []).map((message) => `<li>${escapeHtml(message)}</li>`).join("");
    return `
      <div class="stm-popup">
        <strong>${escapeHtml(stop.name || "Stop")}</strong>
        ${stop.code ? `<div>Stop ${escapeHtml(stop.code)}</div>` : ""}
        ${stop.wheelchair ? `<div class="stm-popup__badge">Wheelchair accessible</div>` : ""}
        ${headwayMin ? `<div>Scheduled avg headway: ${headwayMin} min</div>` : ""}
        ${alerts ? `<ul class="stm-popup__alerts">${alerts}</ul>` : ""}
      </div>
    `;
  }

  function buildRouteAlertPopup(routeId, messages) {
    const items = (messages || []).map((message) => `<li>${escapeHtml(message)}</li>`).join("");
    return `
      <div class="stm-popup stm-popup--alert">
        <strong>Line ${escapeHtml(routeId)} alert</strong>
        <ul class="stm-popup__alerts">${items}</ul>
      </div>
    `;
  }

  function midpoint(points) {
    if (!points?.length) return null;
    return points[Math.floor(points.length / 2)];
  }

  function plotMetroLines(metroPayload) {
    if (!ensureReady("stmLiveMap")) return;
    metroLineLayer.clearLayers();

    (metroPayload?.lines || []).forEach((line) => {
      const color = normalizeColor(line.color, "#455A64");
      (line.shapes || []).forEach((shape) => {
        const points = shape.points || (Array.isArray(shape) ? shape[1] : []);
        if (!points.length) return;
        L.polyline(points.map(([lat, lng]) => [lat, lng]), {
          color,
          weight: METRO_WEIGHT,
          opacity: 0.88,
          lineCap: "round",
          lineJoin: "round"
        }).bindPopup(`
          <div class="stm-popup">
            <strong>${escapeHtml(line.name || `Line ${line.id}`)}</strong>
            <div>${escapeHtml(shape.headsign || "Metro line")}</div>
          </div>
        `).addTo(metroLineLayer);
      });
    });

    metroDrawn = true;
    invalidate();
  }

  function plotRoutes(routePayloads, options = {}) {
    if (!ensureReady("stmLiveMap")) return;

    const {
      alerts = [],
      filters = null,
      fitBounds = true,
      direction = "all",
      accessibleOnly = false,
      headways = null
    } = options;

    routeLayer.clearLayers();
    stopLayer.clearLayers();
    alertLayer.clearLayers();
    const bounds = [];

    (routePayloads || []).forEach((route, routeIndex) => {
      const routeId = String(route.id || route.routeId || "").trim();
      if (!routeId) return;

      const color = normalizeColor(route.color, BUS_ROUTE_COLORS[routeIndex % BUS_ROUTE_COLORS.length]);
      const { stopAlerts, routeAlerts } = filters?.buildStopAlertIndex?.(alerts, routeId, route.stops)
        || { stopAlerts: new Map(), routeAlerts: [] };
      const headwayMin = route.avgHeadwayMin || headways?.routes?.[routeId]?.avgHeadwayMin || null;
      const shapes = filters?.filterShapesByDirection?.(route.shapes, direction) || route.shapes || [];

      shapes.forEach((shape) => {
        const headsign = shape.headsign || (Array.isArray(shape) ? shape[0] : "Direction");
        const points = shape.points || (Array.isArray(shape) ? shape[1] : []);
        if (!points.length) return;
        const latLngs = points.map(([lat, lng]) => [lat, lng]);
        L.polyline(latLngs, {
          color,
          weight: ROUTE_WEIGHT,
          opacity: 0.85,
          lineCap: "round",
          lineJoin: "round"
        }).bindPopup(`
          <div class="stm-popup">
            <strong>Line ${escapeHtml(routeId)}</strong>
            <div>${escapeHtml(route.name || "")}</div>
            <div>${escapeHtml(headsign)}</div>
            ${headwayMin ? `<div>Scheduled avg headway: ${headwayMin} min</div>` : ""}
          </div>
        `).addTo(routeLayer);
        bounds.push(...latLngs);
      });

      (route.stops || []).forEach((stop) => {
        if (accessibleOnly && !stop.wheelchair) return;
        const lat = Number(stop.lat);
        const lng = Number(stop.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const key = stop.id || `${lat},${lng}`;
        const alertEntry = stopAlerts.get(key);
        const hasAlert = Boolean(alertEntry?.messages?.length);

        L.circleMarker([lat, lng], {
          radius: stop.wheelchair ? 6 : hasAlert ? 6 : 4,
          weight: hasAlert ? 2 : 1,
          color: hasAlert ? "#C62828" : stop.wheelchair ? "#1565C0" : "#546E7A",
          fillColor: hasAlert ? "#FFEBEE" : stop.wheelchair ? "#E3F2FD" : "#ECEFF1",
          fillOpacity: 0.95
        })
          .bindPopup(buildStopPopup(stop, alertEntry?.messages, headwayMin))
          .addTo(stopLayer);
        bounds.push([lat, lng]);
      });

      routeAlerts.forEach((entry) => {
        const anchor = midpoint(shapes[0]?.points || shapes[0]?.[1]);
        if (!anchor) return;
        L.marker([anchor[0], anchor[1]], {
          icon: L.divIcon({
            className: "stm-alert-marker",
            html: `<span aria-hidden="true">!</span>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          }),
          zIndexOffset: 500
        })
          .bindPopup(buildRouteAlertPopup(routeId, [entry.text]))
          .addTo(alertLayer);
        bounds.push([anchor[0], anchor[1]]);
      });
    });

    if (fitBounds && bounds.length > 1) {
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
      lastBoundsKey = bounds.map((point) => point.join(",")).join("|");
    }

    invalidate();
  }

  function plotVehicles(vehicles, options = {}) {
    if (!ensureReady("stmLiveMap")) return 0;

    const {
      colorFor = null,
      fitBounds = true,
      preserveBounds = false,
      filters = null,
      meta = null,
      headways = null,
      colorMode = "load"
    } = options;

    markerLayer.clearLayers();
    metroTrainLayer.clearLayers();
    const bounds = [];

    (vehicles || []).forEach((vehicle) => {
      const lat = Number(vehicle.lat);
      const lng = Number(vehicle.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const fillColor = typeof colorFor === "function"
        ? colorFor(vehicle, colorMode)
        : "#F8C607";
      const isSelected = selectedVehicleId && String(vehicle.id) === String(selectedVehicleId);
      const layer = vehicle.isMetro ? metroTrainLayer : markerLayer;

      L.marker([lat, lng], {
        icon: createVehicleIcon(vehicle, {
          fillColor,
          isSelected,
          isMetro: vehicle.isMetro,
          bearing: vehicle.bearing
        }),
        zIndexOffset: isSelected ? 800 : vehicle.isMetro ? 600 : 400
      })
        .bindPopup(buildVehiclePopup(vehicle, filters, meta, headways))
        .on("click", () => {
          if (vehicle.isMetro) return;
          selectedVehicleId = vehicle.id || null;
          onVehicleSelect?.(vehicle);
        })
        .addTo(layer);

      bounds.push([lat, lng]);
    });

    const boundsKey = bounds.map((point) => point.join(",")).join("|");
    const shouldFit = fitBounds && !preserveBounds && bounds.length > 0 && boundsKey !== lastBoundsKey;

    if (shouldFit && bounds.length > 1) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 13 });
      lastBoundsKey = boundsKey;
    } else if (!preserveBounds && !bounds.length && !metroDrawn) {
      map.setView([45.55, -73.62], 11);
      lastBoundsKey = "";
    }

    invalidate();
    return bounds.length;
  }

  function clearRoutes() {
    routeLayer?.clearLayers();
    stopLayer?.clearLayers();
    alertLayer?.clearLayers();
  }

  function clearVehicles() {
    markerLayer?.clearLayers();
    metroTrainLayer?.clearLayers();
  }

  function clear() {
    clearVehicles();
    clearRoutes();
  }

  function setSelectedVehicle(vehicleId) {
    selectedVehicleId = vehicleId || null;
  }

  function setVehicleSelectHandler(handler) {
    onVehicleSelect = typeof handler === "function" ? handler : null;
  }

  function resetBounds() {
    lastBoundsKey = "";
  }

  function panToVehicle(vehicle) {
    if (!map || !vehicle) return;
    const lat = Number(vehicle.lat);
    const lng = Number(vehicle.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    map.setView([lat, lng], Math.max(map.getZoom(), 13), { animate: true });
  }

  return {
    init,
    invalidate,
    clear,
    clearRoutes,
    clearVehicles,
    plotMetroLines,
    plotRoutes,
    plotVehicles,
    setSelectedVehicle,
    setVehicleSelectHandler,
    panToVehicle,
    resetBounds,
    isReady: () => ready
  };
})();
