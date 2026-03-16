/**
 * Cloudflare Worker — Switzerland fuel price proxy.
 *
 * Uses the Navisano/Comparis fuel station API which returns all ~3,980
 * Swiss fuel stations with real-time prices. No auth required.
 *
 * HTTP GET /api/switzerland?lat=X&lng=Y&radius=Z
 *
 * Response is cached for 30 minutes to avoid hammering the upstream API.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const NAVISANO_API = 'https://navisano-prd-fuelprice-api.azurewebsites.net/api/fuelstations';
const CACHE_TTL = 30 * 60; // 30 minutes in seconds

// In-memory cache (persists across requests within same isolate)
let cachedStations = null;
let cacheTimestamp = 0;

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (url.pathname === '/api/switzerland') {
      return handleQuery(url);
    }

    return new Response('Not found', { status: 404 });
  },
};

// ─── Main query handler ──────────────────────────────────────────────
async function handleQuery(url) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const radiusKm = parseFloat(url.searchParams.get('radius') || '10');

  if (isNaN(lat) || isNaN(lng)) {
    return json({ error: 'lat and lng are required' }, 400);
  }

  try {
    const allStations = await fetchAllStations();

    // Filter by distance using bounding box first (fast), then haversine (accurate)
    const dLat = radiusKm / 111;
    const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

    const filtered = allStations
      .filter(
        (s) =>
          s.lat >= lat - dLat &&
          s.lat <= lat + dLat &&
          s.lng >= lng - dLng &&
          s.lng <= lng + dLng
      )
      .map((s) => ({
        ...s,
        distance: Math.round(haversine(lat, lng, s.lat, s.lng) * 100) / 100,
      }))
      .filter((s) => s.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 100);

    return json({ stations: filtered, count: filtered.length });
  } catch (e) {
    console.error('Switzerland proxy error:', e);
    return json({ error: e.message }, 500);
  }
}

// ─── Fetch all stations (cached) ─────────────────────────────────────
async function fetchAllStations() {
  const now = Date.now() / 1000;
  if (cachedStations && now - cacheTimestamp < CACHE_TTL) {
    return cachedStations;
  }

  const res = await fetch(NAVISANO_API);
  if (!res.ok) {
    throw new Error(`Navisano API returned ${res.status}`);
  }

  const raw = await res.json();
  const list = Array.isArray(raw) ? raw : raw?.data || raw?.stations || [];

  const stations = list
    .map((s) => {
      if (s.isDeleted) return null;

      const sLat = parseFloat(s.location?.lat ?? s.latitude ?? s.lat);
      const sLng = parseFloat(s.location?.lng ?? s.longitude ?? s.lng);
      if (isNaN(sLat) || isNaN(sLng)) return null;

      const prices = {};
      const fc = s.fuelCollection;
      if (fc) {
        if (fc.SP95?.displayPrice != null && !fc.SP95.isDeleted)
          prices.E95 = fc.SP95.displayPrice;
        if (fc.SP98?.displayPrice != null && !fc.SP98.isDeleted)
          prices.E98 = fc.SP98.displayPrice;
        if (fc.DIESEL?.displayPrice != null && !fc.DIESEL.isDeleted)
          prices.Diesel = fc.DIESEL.displayPrice;
      }

      // Find the most recent price update
      let lastUpdate = null;
      for (const fuel of Object.values(fc || {})) {
        const ts = fuel?.fiability?.lastPriceUpdate;
        if (ts && (!lastUpdate || ts > lastUpdate)) lastUpdate = ts;
      }

      return {
        id: s.id || null,
        brand: s.brand || s.displayName || 'Tankstelle',
        address: s.formattedAddress || '',
        city: '',
        lat: sLat,
        lng: sLng,
        prices,
        updatedAt: lastUpdate,
      };
    })
    .filter(Boolean)
    .filter((s) => Object.keys(s.prices).length > 0);

  cachedStations = stations;
  cacheTimestamp = now;
  console.log(`Fetched and cached ${stations.length} Swiss fuel stations`);

  return stations;
}

// ─── Haversine distance (km) ─────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── JSON response helper ────────────────────────────────────────────
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
