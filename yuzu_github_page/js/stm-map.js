/**
 * Montreal map layer for STM vehicle positions.
 */
window.StmMap = (function createStmMap() {
  let map = null;
  let markerLayer = null;
  let ready = false;

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

  function plotVehicles(vehicles) {
    if (!ensureReady("stmLiveMap")) return 0;

    clear();
    const bounds = [];

    (vehicles || []).forEach((vehicle) => {
      const lat = Number(vehicle.lat);
      const lng = Number(vehicle.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const marker = L.circleMarker([lat, lng], {
        radius: 4,
        weight: 1,
        color: "#2D3436",
        fillColor: "#F8C607",
        fillOpacity: 0.85
      });

      const label = vehicle.routeId ? `Route ${vehicle.routeId}` : "STM vehicle";
      marker.bindPopup(`<strong>${label}</strong>`);
      marker.addTo(markerLayer);
      bounds.push([lat, lng]);
    });

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 12 });
    } else {
      map.setView([45.55, -73.62], 11);
    }

    invalidate();
    return bounds.length;
  }

  return {
    init,
    invalidate,
    clear,
    plotVehicles,
    isReady: () => ready
  };
})();
