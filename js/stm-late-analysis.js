/**
 * Late arrival analytics from STM GTFS-RT trip updates.
 */
window.StmLateAnalysis = (function createStmLateAnalysis() {
  const LATE_THRESHOLD_SEC = 120;

  const DELAY_BUCKETS = [
    { id: "on_time", label: "On time", min: Number.NEGATIVE_INFINITY, max: 0 },
    { id: "minor", label: "1–2 min", min: 1, max: 119 },
    { id: "late", label: "2–5 min", min: 120, max: 299 },
    { id: "severe", label: "5+ min", min: 300, max: Number.POSITIVE_INFINITY }
  ];

  function getEffectiveDelay(trip) {
    if (trip?.effectiveDelay != null) return Number(trip.effectiveDelay) || 0;
    const tripDelay = Number(trip?.delay) || 0;
    const stopDelay = Number(trip?.maxStopDelay) || 0;
    return Math.max(tripDelay, stopDelay);
  }

  function formatDelay(seconds) {
    const value = Math.max(0, Math.round(Number(seconds) || 0));
    if (value < 60) return `${value}s`;
    const minutes = Math.floor(value / 60);
    const remainder = value % 60;
    return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
  }

  function summarize(tripUpdates) {
    const trips = tripUpdates || [];
    const routeStats = new Map();
    const buckets = Object.fromEntries(DELAY_BUCKETS.map((bucket) => [bucket.id, 0]));

    let lateTrips = 0;
    let minorTrips = 0;
    let onTimeTrips = 0;
    let delayTotal = 0;
    let delayedTripCount = 0;
    let maxDelay = 0;

    trips.forEach((trip) => {
      const routeId = String(trip.routeId || "Unknown");
      const delay = getEffectiveDelay(trip);
      const isLate = delay >= LATE_THRESHOLD_SEC;

      if (delay <= 0) onTimeTrips += 1;
      else if (delay < LATE_THRESHOLD_SEC) minorTrips += 1;
      else lateTrips += 1;

      if (delay > 0) {
        delayTotal += delay;
        delayedTripCount += 1;
      }
      maxDelay = Math.max(maxDelay, delay);

      const bucket = DELAY_BUCKETS.find((item) => delay >= item.min && delay <= item.max);
      if (bucket) buckets[bucket.id] += 1;

      const current = routeStats.get(routeId) || {
        routeId,
        tripCount: 0,
        lateCount: 0,
        delayTotal: 0,
        maxDelay: 0
      };

      current.tripCount += 1;
      current.delayTotal += delay;
      current.maxDelay = Math.max(current.maxDelay, delay);
      if (isLate) current.lateCount += 1;
      routeStats.set(routeId, current);
    });

    const totalTrips = trips.length;
    const onTimeRate = totalTrips ? Math.round((onTimeTrips / totalTrips) * 100) : 0;
    const avgDelay = delayedTripCount ? Math.round(delayTotal / delayedTripCount) : 0;

    const topLateLines = [...routeStats.values()]
      .map((route) => ({
        routeId: route.routeId,
        tripCount: route.tripCount,
        lateCount: route.lateCount,
        avgDelay: route.tripCount ? Math.round(route.delayTotal / route.tripCount) : 0,
        maxDelay: route.maxDelay
      }))
      .sort((a, b) => (
        b.lateCount - a.lateCount
        || b.avgDelay - a.avgDelay
        || b.maxDelay - a.maxDelay
        || a.routeId.localeCompare(b.routeId, undefined, { numeric: true })
      ))
      .slice(0, 5);

    return {
      totalTrips,
      lateTrips,
      minorTrips,
      onTimeTrips,
      onTimeRate,
      avgDelay,
      maxDelay,
      lateThresholdSec: LATE_THRESHOLD_SEC,
      buckets: DELAY_BUCKETS.map((bucket) => ({
        ...bucket,
        count: buckets[bucket.id] || 0
      })),
      topLateLines
    };
  }

  return {
    LATE_THRESHOLD_SEC,
    summarize,
    formatDelay,
    getEffectiveDelay
  };
})();
