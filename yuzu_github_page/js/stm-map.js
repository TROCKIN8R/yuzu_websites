/**
 * Montreal map layer for STM vehicle positions.
 */
window.StmMap = (function createStmMap() {
  let map = null;
  let markerLayer = null;
  let ready = false;
  let lastBoundsKey = "";

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

  function clear() {
    markerLayer?.clearLayers();
  }

  function formatSpeed(speed) {
    const value = Number(speed);
    if (!Number.isFinite(value)) return "—";
    return `${Math.round(value * 3.6)} km/h`;
  }

  function buildPopup(vehicle, filters) {
    const route = vehicle.routeId ? `Line ${vehicle.routeId}` : "STM vehicle";
    const load = filters?.getLoadProfile?.(vehicle) || "unknown";
    const moving = filters?.isMoving?.(vehicle) ? "In motion" : "Stopped";
    const occupancy = vehicle.occupancyLabel
      ? vehicle.occupancyLabel.replace(/_/g, " ")
      : load;

    return `
      <div class="stm-popup">
        <strong>${route}</strong>
        <div>Vehicle ${vehicle.id || "—"}</div>
        <div>Load: ${occupancy}</div>
        <div>${moving} · ${formatSpeed(vehicle.speed)}</div>
      </div>
    `;
  }

  function plotVehicles(vehicles, options = {}) {
    if (!ensureReady("stmLiveMap")) return 0;

    const {
      colorFor = null,
      fitBounds = true,
      filters = null
    } = options;

    clear();
    const bounds = [];

    (vehicles || []).forEach((vehicle) => {
      const lat = Number(vehicle.lat);
      const lng = Number(vehicle.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const fillColor = typeof colorFor === "function"
        ? colorFor(vehicle)
        : "#F8C607";

      const marker = L.circleMarker([lat, lng], {
        radius: 5,
        weight: 1,
        color: "#2D3436",
        fillColor,
        fillOpacity: 0.9
      });

      marker.bindPopup(buildPopup(vehicle, filters));
      marker.addTo(markerLayer);
      bounds.push([lat, lng]);
    });

    const boundsKey = bounds.map((point) => point.join(",")).join("|");
    const shouldFit = fitBounds && bounds.length > 0 && boundsKey !== lastBoundsKey;

    if (shouldFit && bounds.length > 1) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 13 });
      lastBoundsKey = boundsKey;
    } else if (!bounds.length) {
      map.setView([45.55, -73.62], 11);
      lastBoundsKey = "";
    }

    invalidate();
    return bounds.length;
  }

  function resetBounds() {
    lastBoundsKey = "";
  }

  return {
    init,
    invalidate,
    clear,
    plotVehicles,
    resetBounds,
    isReady: () => ready
  };
})();
