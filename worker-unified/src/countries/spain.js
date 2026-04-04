import { filterByDistance, haversine } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getStations, putStations } from '../lib/kv.js';

const COUNTRY = 'ES';
const API_URL =
  'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/';

const MAPBOX_CATEGORY_URL =
  'https://api.mapbox.com/search/searchbox/v1/category/gas_station';
const FSQ_SEARCH_URL = 'https://api.foursquare.com/v2/venues/search';
const FSQ_GAS_CATEGORY = '4bf58dd8d48988d113951735';
const GOOGLE_NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';

/**
 * Spanish API uses comma as decimal separator.
 */
function parseCommaFloat(val) {
  if (val == null || val === '') return NaN;
  return parseFloat(String(val).replace(',', '.'));
}

const FUEL_MAP = {
  'Precio Gasolina 95 E5': 'gasolina95',
  'Precio Gasolina 98 E5': 'gasolina98',
  'Precio Gasoleo A': 'gasoleo',
  'Precio Gases licuados del petróleo': 'glp',
};

// ─── Brand normalization ─────────────────────────────────────────────
// Spanish API returns ALL CAPS, sometimes with location suffixes.
const BRAND_NORMALIZE = {
  repsol: 'Repsol',
  'repsol butano': 'Repsol',
  cepsa: 'Cepsa',
  galp: 'Galp',
  shell: 'Shell',
  bp: 'BP',
  'bp oil': 'BP',
  moeve: 'Moeve',
  ballenoil: 'Ballenoil',
  petronor: 'Petronor',
  plenergy: 'Plenergy',
  carrefour: 'Carrefour',
  petroprix: 'Petroprix',
  eroski: 'Eroski',
  q8: 'Q8',
  tamoil: 'Tamoil',
  avia: 'AVIA',
  alcampo: 'Alcampo',
  meroil: 'Meroil',
  'e.leclerc': 'E.Leclerc',
  eni: 'Eni',
  bonarea: 'Bonarea',
  plenoil: 'Plenoil',
  costco: 'Costco',
  'star petroleum': 'Star',
  scat: 'Scat',
  'confort auto': 'Confort Auto',
  'full & go': 'Full & Go',
  easygas: 'EasyGas',
  gasexpress: 'GasExpress',
  'gm oil': 'GM Oil',
  zoilo: 'Zoilo Ríos',
  'zoilo rios': 'Zoilo Ríos',
  campsa: 'Campsa',
  disa: 'Disa',
  'petrocat directe': 'Petrocat',
  'low cost repost': 'Low Cost Repost',
  'avanza energy': 'Avanza Energy',
  'avanza low cost': 'Avanza Low Cost',
  'ona lowcost': 'ONA Low Cost',
  euskadilowcost: 'Euskadi Low Cost',
};

// Brands with location suffixes (e.g., "BP FERMIN FERNANDEZ" → "BP")
const BRAND_PREFIXES = ['bp', 'repsol', 'cepsa', 'galp', 'shell', 'moeve', 'petronor', 'eni'];

// Non-brand names to ignore
const BRAND_BLACKLIST_NAMES = new Set([
  'estación sur de autobuses de madrid',
]);

// Station-specific brand overrides (keyed by Spanish gov station ID)
const STATION_OVERRIDES = {};

// Stations to exclude — closed, non-existent, or bad data
const STATION_BLACKLIST = new Set([]);

function normalizeBrand(raw) {
  if (!raw || raw === 'Station') return null;
  const key = raw.toLowerCase().trim();
  if (BRAND_BLACKLIST_NAMES.has(key)) return null;
  // Exact match
  if (BRAND_NORMALIZE[key]) return BRAND_NORMALIZE[key];
  // Prefix match: "BP FERMIN FERNANDEZ" → "BP"
  for (const prefix of BRAND_PREFIXES) {
    if (key.startsWith(prefix + ' ') || key.startsWith(prefix + '-')) {
      return BRAND_NORMALIZE[prefix] || prefix.toUpperCase();
    }
  }
  // Title case fallback for unknown brands
  return raw.trim().replace(/\b\w+/g, (w) =>
    w.length <= 2 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  );
}

// ─── Normalize a single station from the Spanish API ─────────────────
function normalize(record) {
  const lat = parseCommaFloat(record['Latitud']);
  const lng = parseCommaFloat(record['Longitud (WGS84)'] || record['Longitud']);
  if (isNaN(lat) || isNaN(lng)) return null;

  const prices = {};
  for (const [field, label] of Object.entries(FUEL_MAP)) {
    const val = parseCommaFloat(record[field]);
    if (!isNaN(val) && val > 0) {
      prices[label] = { price: val };
    }
  }

  if (Object.keys(prices).length === 0) return null;

  const rawBrand = (record['Rótulo'] || '').trim();
  const brand = normalizeBrand(rawBrand) || 'Station';

  return {
    id: String(record['IDEESS'] || ''),
    brand,
    name: brand,
    address: record['Dirección'] || '',
    city: record['Municipio'] || '',
    lat,
    lng,
    country: COUNTRY,
    prices,
  };
}

// ─── Match brands from the stored brand lookup to stations ───────────
function enrichWithStoredBrands(stations, brandLookup) {
  if (!brandLookup || !brandLookup.length) return stations;

  // Spatial index: 0.01-degree cells (~1.1km)
  const grid = new Map();
  for (const b of brandLookup) {
    const key = `${Math.round(b.lat * 100)}:${Math.round(b.lng * 100)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(b);
  }

  return stations.map((s) => {
    // Only enrich stations that still have generic brand
    if (s.brand !== 'Station') {
      // Apply station overrides even for already-branded stations
      if (STATION_OVERRIDES[s.id]) return { ...s, brand: STATION_OVERRIDES[s.id] };
      return s;
    }

    const cellLat = Math.round(s.lat * 100);
    const cellLng = Math.round(s.lng * 100);

    let bestBrand = null;
    let bestDist = 0.5; // 500m
    for (let dLat = -1; dLat <= 1; dLat++) {
      for (let dLng = -1; dLng <= 1; dLng++) {
        const nearby = grid.get(`${cellLat + dLat}:${cellLng + dLng}`);
        if (!nearby) continue;
        for (const b of nearby) {
          const d = haversine(s.lat, s.lng, b.lat, b.lng);
          if (d < bestDist) {
            bestDist = d;
            bestBrand = b.brand;
          }
        }
      }
    }

    if (STATION_OVERRIDES[s.id]) return { ...s, brand: STATION_OVERRIDES[s.id] };
    return bestBrand ? { ...s, brand: bestBrand } : s;
  });
}

// ─── Cron: fetch all stations + normalize + enrich ───────────────────
export async function refresh(env) {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`Spain API ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const raw = data.ListaEESSPrecio || [];
  let stations = raw.map(normalize).filter(Boolean)
    .filter((s) => !STATION_BLACKLIST.has(s.id));

  // Enrich remaining "Station" brands from stored brand DB
  const brandLookup = await env.FUEL_KV.get('brands:ES', { type: 'json' });
  if (brandLookup && brandLookup.length) {
    stations = enrichWithStoredBrands(stations, brandLookup);
  }

  const generic = stations.filter((s) => s.brand === 'Station').length;
  console.log(`[ES] Fetched ${raw.length}, normalized ${stations.length}, generic: ${generic}`);
  await putStations(COUNTRY, stations, env);
}

// ─── Query ───────────────────────────────────────────────────────────
export async function handleQuery(url, env) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const radiusKm = parseFloat(url.searchParams.get('radius') || '15');

  const allStations = await getStations(COUNTRY, env);
  if (!allStations) return json({ error: 'Data not yet cached, try again later' }, 503);

  const filtered = filterByDistance(allStations, lat, lng, radiusKm);
  return json({ stations: filtered, count: filtered.length });
}

// ─── Foursquare brand crawl ──────────────────────────────────────────
export async function buildBrandsFoursquare(env) {
  const clientId = env.FSQ_CLIENT_ID;
  const clientSecret = env.FSQ_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('FSQ_CLIENT_ID / FSQ_CLIENT_SECRET not configured');

  const allStations = await getStations(COUNTRY, env);
  if (!allStations || !allStations.length) {
    throw new Error('No Spanish stations in KV. Run /cron first.');
  }

  const existingBrands = (await env.FUEL_KV.get('brands:ES', { type: 'json' })) || [];

  // Group into 0.05-degree grid cells
  const cells = new Map();
  for (const s of allStations) {
    const lat = Math.round(s.lat * 20) / 20;
    const lng = Math.round(s.lng * 20) / 20;
    const key = `${lat}:${lng}`;
    if (!cells.has(key)) cells.set(key, { lat, lng });
  }

  console.log(`[ES] Foursquare crawl: ${cells.size} cells`);

  const newBrands = [];
  let queried = 0;
  let errors = 0;
  const cellList = [...cells.values()];
  const PARALLEL = 5;

  for (let i = 0; i < cellList.length; i += PARALLEL) {
    const batch = cellList.slice(i, i + PARALLEL);
    const results = await Promise.allSettled(
      batch.map(async (cell) => {
        const params = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          v: '20240101',
          ll: `${cell.lat},${cell.lng}`,
          radius: 5000,
          categoryId: FSQ_GAS_CATEGORY,
          limit: 50,
        });
        const res = await fetch(`${FSQ_SEARCH_URL}?${params}`);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.response?.venues || [])
          .map((v) => {
            const lat = v.location?.lat;
            const lng = v.location?.lng;
            if (lat == null || lng == null) return null;
            const brand = normalizeBrand(v.name);
            if (!brand) return null;
            return { lat, lng, brand };
          })
          .filter(Boolean);
      })
    );

    for (const r of results) {
      queried++;
      if (r.status === 'fulfilled') newBrands.push(...r.value);
      else errors++;
    }

    if (queried % 100 === 0) {
      console.log(`[ES] Foursquare progress: ${queried}/${cellList.length} cells`);
    }
  }

  // Merge & deduplicate
  const merged = [...existingBrands, ...newBrands];
  const seen = new Set();
  const uniqueBrands = merged.filter((b) => {
    const key = `${b.lat.toFixed(5)}:${b.lng.toFixed(5)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  await env.FUEL_KV.put('brands:ES', JSON.stringify(uniqueBrands));

  const added = uniqueBrands.length - existingBrands.length;
  console.log(`[ES] Foursquare: ${added} new brands (total: ${uniqueBrands.length})`);

  return { cells_queried: cells.size, foursquare_found: newBrands.length, new_unique_added: added, total_brands: uniqueBrands.length, errors };
}

// ─── Google Places brand crawl (targets unmatched only) ──────────────
export async function buildBrandsGoogle(env) {
  const apiKey = env.GOOGLE_PLACES_KEY;
  if (!apiKey) throw new Error('GOOGLE_PLACES_KEY not configured');

  const allStations = await getStations(COUNTRY, env);
  if (!allStations || !allStations.length) {
    throw new Error('No Spanish stations in KV. Run /cron first.');
  }

  const existingBrands = (await env.FUEL_KV.get('brands:ES', { type: 'json' })) || [];

  // Build spatial index of existing brands
  const brandGrid = new Map();
  for (const b of existingBrands) {
    const key = `${Math.round(b.lat * 100)}:${Math.round(b.lng * 100)}`;
    if (!brandGrid.has(key)) brandGrid.set(key, []);
    brandGrid.get(key).push(b);
  }

  // Find stations still branded as "Station"
  const unmatched = allStations.filter((s) => {
    if (s.brand !== 'Station') return false;
    const cellLat = Math.round(s.lat * 100);
    const cellLng = Math.round(s.lng * 100);
    for (let dLat = -1; dLat <= 1; dLat++) {
      for (let dLng = -1; dLng <= 1; dLng++) {
        const nearby = brandGrid.get(`${cellLat + dLat}:${cellLng + dLng}`);
        if (!nearby) continue;
        for (const b of nearby) {
          if (haversine(s.lat, s.lng, b.lat, b.lng) < 0.5) return false;
        }
      }
    }
    return true;
  });

  console.log(`[ES] Google Places crawl: ${unmatched.length} unmatched stations`);

  const newBrands = [];
  let queried = 0;
  let errors = 0;
  const PARALLEL = 5;

  for (let i = 0; i < unmatched.length; i += PARALLEL) {
    const batch = unmatched.slice(i, i + PARALLEL);
    const results = await Promise.allSettled(
      batch.map(async (station) => {
        const body = JSON.stringify({
          includedTypes: ['gas_station'],
          locationRestriction: {
            circle: {
              center: { latitude: station.lat, longitude: station.lng },
              radius: 500,
            },
          },
          maxResultCount: 5,
        });
        const res = await fetch(GOOGLE_NEARBY_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'places.displayName,places.location',
          },
          body,
        });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.places || [])
          .map((p) => {
            const lat = p.location?.latitude;
            const lng = p.location?.longitude;
            const name = p.displayName?.text;
            if (lat == null || lng == null || !name) return null;
            const brand = normalizeBrand(name);
            if (!brand) return null;
            return { lat, lng, brand };
          })
          .filter(Boolean);
      })
    );

    for (const r of results) {
      queried++;
      if (r.status === 'fulfilled') newBrands.push(...r.value);
      else errors++;
    }

    if (queried % 100 === 0) {
      console.log(`[ES] Google progress: ${queried}/${unmatched.length}`);
    }
  }

  // Merge into existing brand DB
  const merged = [...existingBrands, ...newBrands];
  const seen = new Set();
  const uniqueBrands = merged.filter((b) => {
    const key = `${b.lat.toFixed(5)}:${b.lng.toFixed(5)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  await env.FUEL_KV.put('brands:ES', JSON.stringify(uniqueBrands));

  const added = uniqueBrands.length - existingBrands.length;
  console.log(`[ES] Google: ${added} new brands (total: ${uniqueBrands.length})`);

  return { unmatched_stations: unmatched.length, google_found: newBrands.length, new_unique_added: added, total_brands: uniqueBrands.length, errors };
}
