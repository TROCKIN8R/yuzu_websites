/**
 * Enrich live STM vehicles with trip delays, freshness, and route meta.
 */
window.StmEnrich = (function createStmEnrich() {
  const LATE_THRESHOLD_SEC = 120;
  const STALE_THRESHOLD_SEC = 120;
  const METRO_ROUTE_IDS = new Set(["1", "2", "4", "5"]);

  const OCCUPANCY_SCORE = {
    0: 0,
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: null,
    7: null,
    8: null
  };

  function indexTripUpdates(tripUpdates) {
    const byTrip = new Map();
    (tripUpdates || []).forEach((trip) => {
      if (trip?.tripId) byTrip.set(String(trip.tripId), trip);
    });
    return byTrip;
  }

  function getEffectiveDelay(trip) {
    if (trip?.effectiveDelay != null) return Number(trip.effectiveDelay) || 0;
    return Math.max(Number(trip?.delay) || 0, Number(trip?.maxStopDelay) || 0);
  }

  function getDelayStatus(delay) {
    if (delay == null || !Number.isFinite(delay)) return "unknown";
    if (delay <= 0) return "on_time";
    if (delay < LATE_THRESHOLD_SEC) return "minor";
    return "late";
  }

  function getSpeedBand(speed) {
    const kmh = Number(speed);
    if (!Number.isFinite(kmh)) return "unknown";
    const value = kmh * 3.6;
    if (value < 10) return "slow";
    if (value <= 30) return "cruising";
    return "fast";
  }

  function isMetroRoute(routeId, meta) {
    const key = String(routeId || "").trim();
    if (meta?.routes?.[key]?.mode === "metro") return true;
    return METRO_ROUTE_IDS.has(key);
  }

  function enrichVehicles(vehicles, options = {}) {
    const {
      tripUpdates = [],
      meta = null,
      nowSec = Math.floor(Date.now() / 1000)
    } = options;

    const tripIndex = indexTripUpdates(tripUpdates);

    return (vehicles || []).map((vehicle) => {
      const trip = vehicle.tripId ? tripIndex.get(String(vehicle.tripId)) : null;
      const delay = trip ? getEffectiveDelay(trip) : null;
      const timestamp = Number(vehicle.timestamp);
      const ageSec = Number.isFinite(timestamp) ? Math.max(0, nowSec - timestamp) : null;
      const routeId = String(vehicle.routeId || "").trim();
      const isMetro = isMetroRoute(routeId, meta);

      return {
        ...vehicle,
        routeId,
        isMetro,
        delay,
        delayStatus: getDelayStatus(delay),
        speedBand: getSpeedBand(vehicle.speed),
        ageSec,
        isStale: ageSec != null ? ageSec > STALE_THRESHOLD_SEC : false,
        occupancyScore: OCCUPANCY_SCORE[vehicle.occupancy] ?? null
      };
    });
  }

  function buildOccupancyRanking(vehicles) {
    const stats = new Map();

    (vehicles || []).forEach((vehicle) => {
      if (vehicle.isMetro) return;
      const routeId = String(vehicle.routeId || "").trim();
      if (!routeId) return;
      const score = vehicle.occupancyScore;
      if (score == null) return;

      const current = stats.get(routeId) || { routeId, total: 0, count: 0 };
      current.total += score;
      current.count += 1;
      stats.set(routeId, current);
    });

    return [...stats.values()]
      .map((row) => ({
        routeId: row.routeId,
        avgOccupancy: row.count ? row.total / row.count : 0,
        vehicleCount: row.count
      }))
      .sort((a, b) => b.avgOccupancy - a.avgOccupancy || b.vehicleCount - a.vehicleCount)
      .slice(0, 10);
  }

  function summarizeFreshness(vehicles) {
    const list = vehicles || [];
    const stale = list.filter((vehicle) => vehicle.isStale).length;
    return { total: list.length, stale, fresh: list.length - stale };
  }

  function summarizeDelay(vehicles) {
    const buses = (vehicles || []).filter((vehicle) => !vehicle.isMetro);
    let onTime = 0;
    let minor = 0;
    let late = 0;
    let unknown = 0;

    buses.forEach((vehicle) => {
      if (vehicle.delayStatus === "on_time") onTime += 1;
      else if (vehicle.delayStatus === "minor") minor += 1;
      else if (vehicle.delayStatus === "late") late += 1;
      else unknown += 1;
    });

    const known = onTime + minor + late;
    return {
      onTime,
      minor,
      late,
      unknown,
      onTimeRate: known ? Math.round((onTime / known) * 100) : null
    };
  }

  return {
    LATE_THRESHOLD_SEC,
    STALE_THRESHOLD_SEC,
    enrichVehicles,
    buildOccupancyRanking,
    summarizeFreshness,
    summarizeDelay,
    getDelayStatus,
    getSpeedBand
  };
})();
