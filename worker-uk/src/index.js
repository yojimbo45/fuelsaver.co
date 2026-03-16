/**
 * Cloudflare Worker — UK fuel price proxy.
 *
 * Aggregates CMA-mandated open data feeds from major UK retailers.
 * Since mid-2024, the CMA requires retailers with 100+ stations to publish
 * daily prices in a standard JSON format.
 *
 * HTTP GET /api/uk?lat=X&lng=Y&radius=Z
 *
 * Cached for 1 hour (retailers update prices daily).
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const CACHE_TTL = 60 * 60; // 1 hour

// CMA-mandated retailer feeds — verified working public JSON endpoints
const RETAILER_FEEDS = [
  { name: 'Asda', url: 'https://storelocator.asda.com/fuel_prices_data.json' },
  { name: 'Shell', url: 'https://www.shell.co.uk/fuel-prices-data.html' },
  { name: 'Esso', url: 'https://fuelprices.esso.co.uk/latestdata.json' },
  { name: 'Morrisons', url: 'https://www.morrisons.com/fuel-prices/fuel.json' },
  { name: 'Sainsburys', url: 'https://api.sainsburys.co.uk/v1/exports/latest/fuel_prices_data.json' },
  { name: 'BP', url: 'https://www.bp.com/en_gb/united-kingdom/home/fuelprices/fuel_prices_data.json' },
  { name: 'Tesco', url: 'https://www.tesco.com/fuel_prices/fuel_prices_data.json' },
];

// CMA standard fuel keys → our normalised keys
const FUEL_MAP = {
  'e10': 'unleaded',     // E10 (standard unleaded since 2021)
  'e5': 'super_unleaded', // E5 (super / premium unleaded)
  'b7': 'diesel',         // B7 (standard diesel)
  'sdv': 'diesel',        // Super diesel variant (fallback to diesel if B7 missing)
};

let cachedStations = null;
let cacheTimestamp = 0;

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (url.pathname === '/api/uk') {
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
    console.error('UK proxy error:', e);
    return json({ error: e.message }, 500);
  }
}

// ─── Fetch all retailer feeds (cached) ──────────────────────────────
async function fetchAllStations() {
  const now = Date.now() / 1000;
  if (cachedStations && now - cacheTimestamp < CACHE_TTL) {
    return cachedStations;
  }

  const results = await Promise.allSettled(
    RETAILER_FEEDS.map(async (feed) => {
      try {
        const res = await fetch(feed.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; FuelSaver/1.0)',
            'Accept': 'application/json, text/html, */*',
          },
        });
        if (!res.ok) {
          console.warn(`${feed.name} feed returned ${res.status}`);
          return [];
        }
        const data = await res.json();
        return parseCMAFeed(data, feed.name);
      } catch (e) {
        console.warn(`${feed.name} feed failed:`, e.message);
        return [];
      }
    })
  );

  const stations = [];
  const successCount = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.length > 0) {
      stations.push(...r.value);
      successCount.push(r.value.length);
    }
  }

  cachedStations = stations;
  cacheTimestamp = now;
  console.log(`Cached ${stations.length} UK stations from ${successCount.length} feeds`);

  return stations;
}

// ─── CMA standard format parser ─────────────────────────────────────
// All retailers use the same schema:
// { last_updated, stations: [{ site_id, brand, address, postcode, location: { latitude, longitude }, prices: { E10: 138.9, B7: 157.9, ... } }] }
function parseCMAFeed(data, fallbackBrand) {
  const list = data?.stations || [];
  return list
    .map((s) => {
      const sLat = parseFloat(s.location?.latitude);
      const sLng = parseFloat(s.location?.longitude);
      if (isNaN(sLat) || isNaN(sLng)) return null;

      // Skip if outside UK/Ireland bounding box
      if (sLat < 49 || sLat > 61 || sLng < -11 || sLng > 2) return null;

      // Map CMA fuel keys (E10, E5, B7, SDV) to our keys (unleaded, super_unleaded, diesel)
      const prices = {};
      for (const [rawKey, val] of Object.entries(s.prices || {})) {
        const normKey = FUEL_MAP[rawKey.toLowerCase()];
        if (!normKey) continue;
        const numVal = parseFloat(val);
        if (isNaN(numVal) || numVal <= 0 || numVal > 300) continue;
        // Don't overwrite if already set (e.g. B7 diesel takes priority over SDV)
        if (prices[normKey] == null) {
          prices[normKey] = numVal;
        }
      }

      if (Object.keys(prices).length === 0) return null;

      return {
        id: s.site_id || `${fallbackBrand}-${sLat}-${sLng}`,
        brand: s.brand || fallbackBrand,
        address: s.address || '',
        city: s.postcode || '',
        lat: sLat,
        lng: sLng,
        prices,
        updatedAt: data.last_updated || null,
      };
    })
    .filter(Boolean);
}

// ─── Haversine distance (km) ────────────────────────────────────────
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

// ─── JSON response helper ───────────────────────────────────────────
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
