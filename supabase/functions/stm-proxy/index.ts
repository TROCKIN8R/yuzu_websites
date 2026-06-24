import GtfsRealtimeBindings from "npm:gtfs-realtime-bindings@1.1.1";

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/yuzu\.solutions$/,
  /^https:\/\/www\.yuzu\.solutions$/,
  /^https:\/\/trockin8r\.github\.io\/yuzu_websites(\/.*)?$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

const SITE_URL = "https://yuzu.solutions";
const MAX_VEHICLES = 900;

const FEEDS = {
  vehiclePositions: {
    url: "https://api.stm.info/pub/od/gtfs-rt/ic/v2/vehiclePositions",
    format: "gtfs-rt",
  },
  tripUpdates: {
    url: "https://api.stm.info/pub/od/gtfs-rt/ic/v2/tripUpdates",
    format: "gtfs-rt",
  },
  serviceStatus: {
    url: "https://api.stm.info/pub/od/i3/v2/messages/etatservice",
    format: "json",
  },
} as const;

type FeedName = keyof typeof FEEDS;

function isAllowedOrigin(origin: string | null) {
  if (!origin) return true;
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

function resolveCorsOrigin(origin: string | null) {
  if (origin && ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))) {
    return origin;
  }
  return SITE_URL;
}

function buildCorsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": resolveCorsOrigin(origin),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    Vary: "Origin",
  };
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  origin: string | null = null,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(origin),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function getApiKey() {
  let raw = Deno.env.get("STM_API_KEY")?.trim() || "";
  if (!raw) return "";

  // Common paste mistakes in Supabase/GitHub secret UIs.
  raw = raw.replace(/^STM_API_KEY\s*=\s*/i, "");
  raw = raw.replace(/^["']|["']$/g, "").trim();

  return raw;
}

function buildStmHeaders(apiKey: string, accept: string) {
  return {
    // STM portal "Authorize" uses apiKey; some examples use apikey.
    apiKey,
    apikey: apiKey,
    accept,
  };
}

function decodeGtfsRt(buffer: ArrayBuffer, feed: FeedName) {
  const message = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
    new Uint8Array(buffer),
  );

  if (feed === "vehiclePositions") {
    const vehicles: Array<Record<string, unknown>> = [];

    for (const entity of message.entity || []) {
      const vehicle = entity.vehicle;
      const position = vehicle?.position;
      if (!vehicle || !position) continue;
      if (position.latitude == null || position.longitude == null) continue;

      vehicles.push({
        id: entity.id || vehicle.vehicle?.id || null,
        routeId: vehicle.trip?.routeId || null,
        tripId: vehicle.trip?.tripId || null,
        lat: position.latitude,
        lng: position.longitude,
        bearing: position.bearing ?? null,
        speed: position.speed ?? null,
        occupancy: vehicle.occupancyStatus ?? null,
        timestamp: vehicle.timestamp ?? message.header?.timestamp ?? null,
      });

      if (vehicles.length >= MAX_VEHICLES) break;
    }

    return {
      feed,
      headerTimestamp: message.header?.timestamp ?? null,
      entityCount: message.entity?.length ?? 0,
      vehicleCount: vehicles.length,
      vehicles,
    };
  }

  const updates: Array<Record<string, unknown>> = [];
  for (const entity of message.entity || []) {
    const tripUpdate = entity.tripUpdate;
    if (!tripUpdate) continue;

    updates.push({
      id: entity.id || null,
      routeId: tripUpdate.trip?.routeId || null,
      tripId: tripUpdate.trip?.tripId || null,
      delay: tripUpdate.delay ?? null,
      stopTimeUpdateCount: tripUpdate.stopTimeUpdate?.length ?? 0,
    });

    if (updates.length >= MAX_VEHICLES) break;
  }

  return {
    feed,
    headerTimestamp: message.header?.timestamp ?? null,
    entityCount: message.entity?.length ?? 0,
    tripUpdateCount: updates.length,
    tripUpdates: updates,
  };
}

async function fetchStmFeed(feedName: FeedName, apiKey: string) {
  const feed = FEEDS[feedName];
  const accept = feed.format === "json"
    ? "application/json"
    : "application/x-protobuf";

  const response = await fetch(feed.url, {
    headers: buildStmHeaders(apiKey, accept),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`STM API ${response.status}${detail ? `: ${detail.slice(0, 180)}` : ""}`);
  }

  const fetchedAt = new Date().toISOString();

  if (feed.format === "json") {
    const payload = await response.json();
    return {
      feed: feedName,
      fetchedAt,
      serviceStatus: payload,
    };
  }

  const buffer = await response.arrayBuffer();
  const decoded = decodeGtfsRt(buffer, feedName);
  return {
    ...decoded,
    fetchedAt,
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    if (!isAllowedOrigin(origin)) {
      return jsonResponse({ error: "Origin not allowed" }, 403, origin);
    }
    return new Response(null, { headers: buildCorsHeaders(origin) });
  }

  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405, origin);
  }

  if (!isAllowedOrigin(origin)) {
    return jsonResponse({ error: "Origin not allowed" }, 403, origin);
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return jsonResponse({
      error: "STM_API_KEY is not configured. Add it in Supabase Edge Function secrets.",
    }, 503, origin);
  }

  const url = new URL(req.url);
  const feedParam = (url.searchParams.get("feed") || "serviceStatus").trim();

  if (feedParam === "health") {
    return jsonResponse({
      ok: true,
      configured: true,
      keyLength: apiKey.length,
      hint: "Secret is loaded. If STM still returns Invalid API Key, re-copy the key from the STM portal and ensure the app is Published.",
    }, 200, origin);
  }

  const feedName = feedParam in FEEDS ? feedParam as FeedName : null;

  if (!feedName) {
    return jsonResponse({
      error: "Unknown feed",
      allowedFeeds: Object.keys(FEEDS),
    }, 400, origin);
  }

  try {
    const payload = await fetchStmFeed(feedName, apiKey);
    return jsonResponse({ ok: true, ...payload }, 200, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "STM proxy failed";
    const invalidKey = /invalid api key/i.test(message);
    return jsonResponse({
      error: message,
      hint: invalidKey
        ? "Re-copy the API key from portail.developpeurs.stm.info (value only, no STM_API_KEY= prefix). App must be Published/Enabled with GTFS-RT v2 and API i3 subscribed."
        : undefined,
      keyLength: apiKey.length,
    }, 502, origin);
  }
});
