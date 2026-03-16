/**
 * Cloudflare Worker — Italy fuel price proxy.
 *
 * Fetches MIMIT (Ministry of Industry) open data CSVs:
 *   - anagrafica_impianti_attivi.csv  → station registry (id, brand, address, lat, lng)
 *   - prezzo_alle_8.csv              → daily prices at 8 AM
 *
 * HTTP GET /api/italy?lat=X&lng=Y&radius=Z
 *
 * Cached for 2 hours (prices update once daily at 8 AM).
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const ANAGRAFICA_URL =
  'https://www.mimit.gov.it/images/exportCSV/anagrafica_impianti_attivi.csv';
const PREZZI_URL =
  'https://www.mimit.gov.it/images/exportCSV/prezzo_alle_8.csv';

const CACHE_TTL = 2 * 60 * 60; // 2 hours

let cachedStations = null;
let cacheTimestamp = 0;

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (url.pathname === '/api/italy') {
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

    // Bounding-box pre-filter then haversine
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
    console.error('Italy proxy error:', e);
    return json({ error: e.message }, 500);
  }
}

// ─── Fetch & merge both CSVs (cached) ───────────────────────────────
async function fetchAllStations() {
  const now = Date.now() / 1000;
  if (cachedStations && now - cacheTimestamp < CACHE_TTL) {
    return cachedStations;
  }

  const [anagText, prezziText] = await Promise.all([
    fetch(ANAGRAFICA_URL).then((r) => {
      if (!r.ok) throw new Error(`Anagrafica CSV returned ${r.status}`);
      return r.text();
    }),
    fetch(PREZZI_URL).then((r) => {
      if (!r.ok) throw new Error(`Prezzi CSV returned ${r.status}`);
      return r.text();
    }),
  ]);

  // Parse station registry
  const stationMap = parseAnagrafica(anagText);

  // Parse prices and merge into stations
  parsePrezzi(prezziText, stationMap);

  // Collect stations that have at least one price
  const stations = [];
  for (const s of stationMap.values()) {
    if (Object.keys(s.prices).length > 0) {
      stations.push(s);
    }
  }

  cachedStations = stations;
  cacheTimestamp = now;
  console.log(`Fetched and cached ${stations.length} Italian fuel stations`);

  return stations;
}

// ─── CSV parsers ────────────────────────────────────────────────────

/**
 * Anagrafica CSV columns (pipe-separated, first line is date header):
 * idImpianto|Gestore|Bandiera|Tipo Impianto|Nome Impianto|Indirizzo|Comune|Provincia|Latitudine|Longitudine
 */
function parseAnagrafica(text) {
  const map = new Map();
  const lines = text.split('\n');

  // First line is "Estrazione del YYYY-MM-DD", second is column headers, data starts at line 3
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = splitCSVLine(line, '|');
    if (cols.length < 10) continue;

    const id = cols[0].trim();
    const lat = parseFloat(cols[8].replace(',', '.'));
    const lng = parseFloat(cols[9].replace(',', '.'));
    if (!id || isNaN(lat) || isNaN(lng)) continue;

    // Skip obviously wrong coordinates (outside Italy bounding box)
    if (lat < 35 || lat > 48 || lng < 6 || lng > 19) continue;

    map.set(id, {
      id,
      brand: cols[2].trim() || cols[1].trim() || 'Distributore',
      address: cols[5].trim(),
      city: cols[6].trim(),
      lat,
      lng,
      prices: {},
      updatedAt: null,
    });
  }

  return map;
}

/**
 * Prezzi CSV columns (pipe-separated, first line is date header):
 * idImpianto|descCarburante|prezzo|isSelf|dtComu
 */
function parsePrezzi(text, stationMap) {
  const lines = text.split('\n');

  // Fuel type mapping to our standard keys
  const FUEL_MAP = {
    'benzina': 'benzina',
    'gasolio': 'gasolio',
    'gpl': 'gpl',
    'metano': 'metano',
    'benzina special': 'benzina',
    'gasolio speciale': 'gasolio',
    'gasolio artico': 'gasolio',
    'gasolio alpino': 'gasolio',
    'gnl': 'metano',
    'l-gnc': 'metano',
  };

  // First line is "Estrazione del YYYY-MM-DD", second is column headers, data starts at line 3
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = splitCSVLine(line, '|');
    if (cols.length < 5) continue;

    const id = cols[0].trim();
    const station = stationMap.get(id);
    if (!station) continue;

    const rawFuel = cols[1].trim().toLowerCase();
    const price = parseFloat(cols[2].replace(',', '.'));
    const isSelf = cols[3].trim() === '1';
    const dateStr = cols[4].trim();

    if (isNaN(price) || price <= 0 || price > 10) continue;

    const fuelKey = FUEL_MAP[rawFuel];
    if (!fuelKey) continue;

    // Prefer self-service prices (cheaper); only overwrite if current is not self-service
    const existingPrice = station.prices[fuelKey];
    if (existingPrice == null || isSelf) {
      station.prices[fuelKey] = price;
    }

    // Track most recent update
    if (dateStr && (!station.updatedAt || dateStr > station.updatedAt)) {
      station.updatedAt = dateStr;
    }
  }
}

/**
 * Split a CSV line respecting quoted fields.
 */
function splitCSVLine(line, sep) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === sep && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
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
