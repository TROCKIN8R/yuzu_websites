/**
 * Demo-only metro train positions estimated from scheduled headways + line geometry.
 * Not live STM train telemetry.
 */
window.StmMetroSim = (function createStmMetroSim() {
  const EARTH_RADIUS_M = 6371000;
  const COMMERCIAL_SPEED_MPS = 9; // ~32 km/h including station dwell
  const MIN_TRAINS_PER_DIR = 1;
  const MAX_TRAINS_PER_DIR = 18;
  const DEFAULT_HEADWAY_MIN = 3;

  function toRad(deg) {
    return (deg * Math.PI) / 180;
  }

  function haversineMeters(a, b) {
    const lat1 = toRad(a[0]);
    const lat2 = toRad(b[0]);
    const dLat = lat2 - lat1;
    const dLng = toRad(b[1] - a[1]);
    const h = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function bearingDegrees(a, b) {
    const lat1 = toRad(a[0]);
    const lat2 = toRad(b[0]);
    const dLng = toRad(b[1] - a[1]);
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2)
      - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  function buildPathMetrics(points) {
    const segments = [];
    let total = 0;
    for (let i = 1; i < points.length; i += 1) {
      const length = haversineMeters(points[i - 1], points[i]);
      segments.push({
        start: points[i - 1],
        end: points[i],
        length,
        startDist: total
      });
      total += length;
    }
    return { segments, total };
  }

  function pointAtDistance(metrics, distance) {
    const { segments, total } = metrics;
    if (!segments.length || total <= 0) return null;

    const clamped = ((distance % total) + total) % total;
    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i];
      if (clamped > segment.startDist + segment.length && i < segments.length - 1) continue;
      const local = Math.min(segment.length, Math.max(0, clamped - segment.startDist));
      const t = segment.length ? local / segment.length : 0;
      return {
        lat: segment.start[0] + (segment.end[0] - segment.start[0]) * t,
        lng: segment.start[1] + (segment.end[1] - segment.start[1]) * t,
        bearing: bearingDegrees(segment.start, segment.end)
      };
    }
    const last = segments[segments.length - 1];
    return {
      lat: last.end[0],
      lng: last.end[1],
      bearing: bearingDegrees(last.start, last.end)
    };
  }

  function shapePoints(shape) {
    if (!shape) return [];
    if (Array.isArray(shape.points)) return shape.points;
    if (Array.isArray(shape) && Array.isArray(shape[1])) return shape[1];
    return [];
  }

  function shapeLength(shape) {
    const points = shapePoints(shape);
    if (points.length < 2) return 0;
    return buildPathMetrics(points).total;
  }

  function directionShapes(line) {
    const shapes = (line?.shapes || [])
      .filter((shape) => shapePoints(shape).length >= 2)
      .sort((a, b) => shapeLength(b) - shapeLength(a));

    const picked = [];
    const seen = new Set();
    for (const shape of shapes) {
      const points = shapePoints(shape);
      const key = shape.headsign
        || `${points[0][0].toFixed(3)},${points[0][1].toFixed(3)}→${points[points.length - 1][0].toFixed(3)},${points[points.length - 1][1].toFixed(3)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push(shape);
      if (picked.length >= 2) break;
    }
    return picked;
  }

  function resolveHeadwayMin(line, headways) {
    const fromLine = Number(line?.avgHeadwayMin);
    if (Number.isFinite(fromLine) && fromLine > 0) return fromLine;
    const fromFeed = Number(headways?.routes?.[String(line?.id)]?.avgHeadwayMin);
    if (Number.isFinite(fromFeed) && fromFeed > 0) return fromFeed;
    return DEFAULT_HEADWAY_MIN;
  }

  function trainCountForDirection(tripMinutes, headwayMin) {
    const hw = Math.max(0.75, Number(headwayMin) || DEFAULT_HEADWAY_MIN);
    const trip = Math.max(hw, Number(tripMinutes) || hw);
    return Math.max(
      MIN_TRAINS_PER_DIR,
      Math.min(MAX_TRAINS_PER_DIR, Math.round(trip / hw))
    );
  }

  function normalizeColor(color, fallback) {
    const raw = String(color || "").trim();
    if (!raw) return fallback;
    return raw.startsWith("#") ? raw : `#${raw}`;
  }

  function simulate(metroPayload, headways, nowMs = Date.now()) {
    const vehicles = [];
    const nowSec = Math.floor(nowMs / 1000);

    (metroPayload?.lines || []).forEach((line) => {
      const routeId = String(line.id || "").trim();
      if (!routeId) return;

      const headwayMin = resolveHeadwayMin(line, headways);
      const headwayMs = headwayMin * 60 * 1000;
      const routeColor = normalizeColor(line.color, "#455A64");
      const shapes = directionShapes(line);

      shapes.forEach((shape, shapeIndex) => {
        const points = shapePoints(shape);
        const metrics = buildPathMetrics(points);
        if (metrics.total < 200) return;

        const tripMinutes = (metrics.total / COMMERCIAL_SPEED_MPS) / 60;
        const count = trainCountForDirection(tripMinutes, headwayMin);
        const spacingM = metrics.total / count;
        // Fleet advances one headway spacing per headway interval.
        const phaseM = ((nowMs / headwayMs) % 1) * spacingM;

        for (let i = 0; i < count; i += 1) {
          const distance = (i * spacingM + phaseM) % metrics.total;
          const point = pointAtDistance(metrics, distance);
          if (!point) continue;

          vehicles.push({
            id: `metro-sim-${routeId}-${shapeIndex}-${i}`,
            routeId,
            tripId: null,
            lat: point.lat,
            lng: point.lng,
            bearing: point.bearing,
            speed: COMMERCIAL_SPEED_MPS,
            speedBand: "cruising",
            timestamp: nowSec,
            ageSec: 0,
            isStale: false,
            occupancy: null,
            occupancyLabel: null,
            occupancyScore: null,
            delay: null,
            delayStatus: "unknown",
            isMetro: true,
            isEstimated: true,
            avgHeadwayMin: headwayMin,
            routeColor,
            headsign: shape.headsign || null
          });
        }
      });
    });

    return vehicles;
  }

  return {
    simulate,
    trainCountForDirection,
    resolveHeadwayMin
  };
})();
