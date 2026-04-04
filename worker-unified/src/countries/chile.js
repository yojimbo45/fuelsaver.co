import { filterByDistance, haversine } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getStations, putStations } from '../lib/kv.js';

const COUNTRY = 'CL';
const API_URL = 'https://api.bencinaenlinea.cl/api/busqueda_estacion_filtro';

const FSQ_SEARCH_URL = 'https://api.foursquare.com/v2/venues/search';
const FSQ_GAS_CATEGORY = '4bf58dd8d48988d113951735';
const GOOGLE_NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';

const FUEL_MAP = {
  '93': 'gasolina93',
  'A93': 'gasolina93',
  '95': 'gasolina95',
  'A95': 'gasolina95',
  '97': 'gasolina97',
  'A97': 'gasolina97',
  'DI': 'diesel',
  'ADI': 'diesel',
  'GLP': 'glp',
  'GNC': 'gnc',
  'KE': 'kerosene',
};

// Map Chilean API logo filenames to brand names
const LOGO_TO_BRAND = {
  'shell': 'Shell',
  'copec': 'COPEC',
  'aramco': 'Aramco',
  'gulf': 'Gulf',
  'gasco': 'Gasco',
  'okey': 'Okey',
  'petrobras': 'Petrobras',
  'terpel': 'Terpel',
  'enex': 'ENEX',
  // Generic logo files from the Chilean API
  'logo5': 'COPEC',     // 51 stations — Chile's largest chain
  'logo12': 'Petrobras',
  'logo23': 'Terpel',
  'logo26': 'ENEX',
};

const BRAND_NORMALIZE = {
  copec: 'COPEC',
  shell: 'Shell',
  aramco: 'Aramco',
  gulf: 'Gulf',
  gasco: 'Gasco',
  okey: 'Okey',
  petrobras: 'Petrobras',
  terpel: 'Terpel',
  enex: 'ENEX',
};

function normalizeBrand(raw) {
  if (!raw) return null;
  const key = raw.toLowerCase().trim();
  if (BRAND_NORMALIZE[key]) return BRAND_NORMALIZE[key];
  for (const [brand, canonical] of Object.entries(BRAND_NORMALIZE)) {
    if (key.startsWith(brand + ' ') || key.startsWith(brand + '-')) {
      return canonical;
    }
  }
  return raw.trim();
}

// Extract brand from the Chilean API logo URL filename
function brandFromLogo(logoUrl) {
  if (!logoUrl) return null;
  const fname = logoUrl.split('/').pop().toLowerCase();
  for (const [key, brand] of Object.entries(LOGO_TO_BRAND)) {
    if (fname.includes(key.toLowerCase())) return brand;
  }
  return null;
}

const STATION_OVERRIDES = {};
const STATION_BLACKLIST = new Set([]);

function normalize(record) {
  const lat = parseFloat(record.latitud);
  const lng = parseFloat(record.longitud);
  if (isNaN(lat) || isNaN(lng)) return null;

  const prices = {};
  let latestDate = null;

  if (Array.isArray(record.combustibles)) {
    for (const c of record.combustibles) {
      const label = FUEL_MAP[c.nombre_corto];
      if (!label) continue;

      const val = parseFloat(c.precio);
      if (isNaN(val) || val <= 0) continue;

      if (!prices[label] || val < prices[label].price) {
        prices[label] = { price: val };
      }

      if (c.precio_fecha && (!latestDate || c.precio_fecha > latestDate)) {
        latestDate = c.precio_fecha;
      }
    }
  }

  if (Object.keys(prices).length === 0) return null;

  // Extract brand from logo filename — no direct logo URL needed,
  // the frontend will use getBrandLogoUrl() → Brandfetch
  const brand = brandFromLogo(record.logo) || 'Station';

  return {
    id: String(record.id ?? ''),
    brand,
    name: record.direccion || '',
    address: record.direccion || '',
    city: record.comuna || '',
    lat,
    lng,
    country: COUNTRY,
    prices,
    updatedAt: latestDate,
  };
}

// ─── Match brands from the stored brand lookup to stations ───────────
function enrichWithStoredBrands(stations, brandLookup) {
  if (!brandLookup || !brandLookup.length) return stations;

  const grid = new Map();
  for (const b of brandLookup) {
    const key = `${Math.round(b.lat * 100)}:${Math.round(b.lng * 100)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(b);
  }

  return stations.map((s) => {
    if (STATION_OVERRIDES[s.id]) return { ...s, brand: STATION_OVERRIDES[s.id] };
    if (s.brand !== 'Station') return s;

    const cellLat = Math.round(s.lat * 100);
    const cellLng = Math.round(s.lng * 100);
    let bestBrand = null;
    let bestDist = 0.5;
    for (let dLat = -1; dLat <= 1; dLat++) {
      for (let dLng = -1; dLng <= 1; dLng++) {
        const nearby = grid.get(`${cellLat + dLat}:${cellLng + dLng}`);
        if (!nearby) continue;
        for (const b of nearby) {
          const d = haversine(s.lat, s.lng, b.lat, b.lng);
          if (d < bestDist) { bestDist = d; bestBrand = b.brand; }
        }
      }
    }
    return bestBrand ? { ...s, brand: bestBrand } : s;
  });
}

export async function refresh(env) {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`Chile API ${res.status}: ${await res.text()}`);

  const body = await res.json();
  const raw = body.data || (Array.isArray(body) ? body : []);
  let stations = raw.map(normalize).filter(Boolean)
    .filter((s) => !STATION_BLACKLIST.has(s.id));

  const brandLookup = await env.FUEL_KV.get('brands:CL', { type: 'json' });
  if (brandLookup && brandLookup.length) {
    stations = enrichWithStoredBrands(stations, brandLookup);
  }

  const generic = stations.filter((s) => s.brand === 'Station').length;
  console.log(`[CL] Fetched ${raw.length}, normalized ${stations.length}, generic: ${generic}`);
  await putStations(COUNTRY, stations, env);
}

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
  if (!allStations || !allStations.length) throw new Error('No Chilean stations in KV. Run /cron first.');

  const existingBrands = (await env.FUEL_KV.get('brands:CL', { type: 'json' })) || [];

  const cells = new Map();
  for (const s of allStations) {
    const lat = Math.round(s.lat * 20) / 20;
    const lng = Math.round(s.lng * 20) / 20;
    const key = `${lat}:${lng}`;
    if (!cells.has(key)) cells.set(key, { lat, lng });
  }

  const newBrands = [];
  let queried = 0, errors = 0;
  const cellList = [...cells.values()];

  for (let i = 0; i < cellList.length; i += 5) {
    const batch = cellList.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map(async (cell) => {
        const params = new URLSearchParams({
          client_id: clientId, client_secret: clientSecret,
          v: '20240101', ll: `${cell.lat},${cell.lng}`,
          radius: 5000, categoryId: FSQ_GAS_CATEGORY, limit: 50,
        });
        const res = await fetch(`${FSQ_SEARCH_URL}?${params}`);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.response?.venues || []).map((v) => {
          const lat = v.location?.lat, lng = v.location?.lng;
          if (lat == null || lng == null) return null;
          const brand = normalizeBrand(v.name);
          return brand ? { lat, lng, brand } : null;
        }).filter(Boolean);
      })
    );
    for (const r of results) {
      queried++;
      if (r.status === 'fulfilled') newBrands.push(...r.value);
      else errors++;
    }
  }

  const merged = [...existingBrands, ...newBrands];
  const seen = new Set();
  const unique = merged.filter((b) => {
    const k = `${b.lat.toFixed(5)}:${b.lng.toFixed(5)}`;
    if (seen.has(k)) return false; seen.add(k); return true;
  });
  await env.FUEL_KV.put('brands:CL', JSON.stringify(unique));
  const added = unique.length - existingBrands.length;
  return { cells_queried: cells.size, foursquare_found: newBrands.length, new_unique_added: added, total_brands: unique.length, errors };
}

// ─── Google Places brand crawl ───────────────────────────────────────
export async function buildBrandsGoogle(env) {
  const apiKey = env.GOOGLE_PLACES_KEY;
  if (!apiKey) throw new Error('GOOGLE_PLACES_KEY not configured');

  const allStations = await getStations(COUNTRY, env);
  if (!allStations || !allStations.length) throw new Error('No Chilean stations in KV. Run /cron first.');

  const existingBrands = (await env.FUEL_KV.get('brands:CL', { type: 'json' })) || [];

  const brandGrid = new Map();
  for (const b of existingBrands) {
    const key = `${Math.round(b.lat * 100)}:${Math.round(b.lng * 100)}`;
    if (!brandGrid.has(key)) brandGrid.set(key, []);
    brandGrid.get(key).push(b);
  }

  const unmatched = allStations.filter((s) => {
    if (s.brand !== 'Station') return false;
    const cLat = Math.round(s.lat * 100), cLng = Math.round(s.lng * 100);
    for (let dLat = -1; dLat <= 1; dLat++)
      for (let dLng = -1; dLng <= 1; dLng++) {
        const nearby = brandGrid.get(`${cLat + dLat}:${cLng + dLng}`);
        if (nearby) for (const b of nearby) if (haversine(s.lat, s.lng, b.lat, b.lng) < 0.5) return false;
      }
    return true;
  });

  const newBrands = [];
  let queried = 0, errors = 0;
  for (let i = 0; i < unmatched.length; i += 5) {
    const batch = unmatched.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map(async (station) => {
        const res = await fetch(GOOGLE_NEARBY_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'places.displayName,places.location',
          },
          body: JSON.stringify({
            includedTypes: ['gas_station'],
            locationRestriction: { circle: { center: { latitude: station.lat, longitude: station.lng }, radius: 500 } },
            maxResultCount: 5,
          }),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.places || []).map((p) => {
          const lat = p.location?.latitude, lng = p.location?.longitude, name = p.displayName?.text;
          if (lat == null || !name) return null;
          const brand = normalizeBrand(name);
          return brand ? { lat, lng, brand } : null;
        }).filter(Boolean);
      })
    );
    for (const r of results) {
      queried++;
      if (r.status === 'fulfilled') newBrands.push(...r.value);
      else errors++;
    }
  }

  const merged = [...existingBrands, ...newBrands];
  const seen = new Set();
  const unique = merged.filter((b) => {
    const k = `${b.lat.toFixed(5)}:${b.lng.toFixed(5)}`;
    if (seen.has(k)) return false; seen.add(k); return true;
  });
  await env.FUEL_KV.put('brands:CL', JSON.stringify(unique));
  const added = unique.length - existingBrands.length;
  return { unmatched_stations: unmatched.length, google_found: newBrands.length, new_unique_added: added, total_brands: unique.length, errors };
}
