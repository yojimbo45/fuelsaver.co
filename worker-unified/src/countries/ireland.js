/**
 * Ireland — Pumps.ie crowd-sourced fuel price data.
 *
 * Fetches all ~1,835 stations via the pumps.ie XML API for both
 * petrol and diesel, merges by station ID, and caches in KV.
 *
 * Country code: IE
 */

import { filterByDistance } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getStations, putStations } from '../lib/kv.js';

const COUNTRY = 'IE';

// Bounding box covering all of Ireland
const API_BASE = 'https://pumps.ie/api/getStationsByPriceAPI.php';
const BBOX = 'minLat=51.0&maxLat=56.0&minLng=-11.0&maxLng=-5.0';

const BRAND_MAP = {
  'circle k': 'Circle K', topaz: 'Circle K',
  applegreen: 'Applegreen', maxol: 'Maxol',
  texaco: 'Texaco', emo: 'Emo', amber: 'Amber',
  certa: 'Certa', campus: 'Campus', inver: 'Inver',
  'corrib oil': 'Corrib Oil', go: 'Go', top: 'Top',
  shell: 'Shell', bp: 'BP', esso: 'Esso',
  independent: 'Independent', jet: 'Jet',
  supervalu: 'SuperValu', centra: 'Centra',
};

function normalizeBrand(raw) {
  if (!raw) return 'Station';
  const key = raw.toLowerCase().trim();
  return BRAND_MAP[key] || raw.trim();
}

/**
 * Parse pumps.ie XML response into station objects.
 * Format: <stations><station ID="66" Lat="53.3" Lng="-6.2" name="Top"
 *   brand="Top" addr1="..." addr2="..." price="135.9" fuel="Petrol"
 *   dateupdated="2024-06-30 22:54:17" County="Dublin" /></stations>
 */
function parseXml(xml, fuelKey) {
  const stations = [];
  const re = /<station\s([^>]+)\/?\s*>/gi;
  let match;

  while ((match = re.exec(xml)) !== null) {
    const attrs = match[1];
    const get = (name) => {
      const m = attrs.match(new RegExp(`${name}="([^"]*)"`));
      return m ? m[1] : '';
    };

    const id = get('ID');
    const lat = parseFloat(get('Lat'));
    const lng = parseFloat(get('Lng'));
    if (!id || isNaN(lat) || isNaN(lng)) continue;

    // Skip bogus prices
    const price = parseFloat(get('price'));
    if (isNaN(price) || price <= 0 || price > 500) continue;

    stations.push({
      id,
      brand: get('brand'),
      name: get('name'),
      addr1: get('addr1'),
      addr2: get('addr2'),
      county: get('County'),
      lat,
      lng,
      fuelKey,
      price,
      updatedAt: get('dateupdated') || null,
    });
  }

  return stations;
}

// ─── Query handler (Tier A pattern) ────────────────────────────────
export async function handleQuery(url, env) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const radiusKm = parseFloat(url.searchParams.get('radius') || '15');

  const allStations = await getStations(COUNTRY, env);
  if (!allStations) return json({ error: 'Data not yet cached, try again later' }, 503);

  const filtered = filterByDistance(allStations, lat, lng, radiusKm);
  return json({ stations: filtered, count: filtered.length });
}

// ─── Refresh: fetch petrol + diesel, merge, store in KV ────────────
export async function refresh(env) {
  const [petrolRes, dieselRes] = await Promise.all([
    fetch(`${API_BASE}?${BBOX}&fuel=petrol&noCache=${Math.random()}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FuelSaver/1.0)' },
    }),
    fetch(`${API_BASE}?${BBOX}&fuel=diesel&noCache=${Math.random()}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FuelSaver/1.0)' },
    }),
  ]);

  if (!petrolRes.ok && !dieselRes.ok) {
    console.error(`[IE] Both feeds failed: petrol=${petrolRes.status}, diesel=${dieselRes.status}`);
    return;
  }

  const petrolXml = petrolRes.ok ? await petrolRes.text() : '';
  const dieselXml = dieselRes.ok ? await dieselRes.text() : '';

  const petrolStations = parseXml(petrolXml, 'unleaded');
  const dieselStations = parseXml(dieselXml, 'diesel');

  // Merge by station ID
  const stationMap = new Map();

  for (const s of [...petrolStations, ...dieselStations]) {
    if (!stationMap.has(s.id)) {
      stationMap.set(s.id, {
        id: `IE-${s.id}`,
        brand: normalizeBrand(s.brand),
        name: s.name || normalizeBrand(s.brand),
        address: [s.addr1, s.addr2].filter(Boolean).join(', '),
        city: s.county || '',
        lat: s.lat,
        lng: s.lng,
        country: COUNTRY,
        prices: {},
        updatedAt: s.updatedAt,
      });
    }

    const station = stationMap.get(s.id);
    // Price is in cents/L (e.g. 175.9) — store as-is, frontend handles display
    station.prices[s.fuelKey] = s.price;

    // Keep the most recent update timestamp
    if (s.updatedAt && (!station.updatedAt || s.updatedAt > station.updatedAt)) {
      station.updatedAt = s.updatedAt;
    }
  }

  const stations = Array.from(stationMap.values());

  await putStations(COUNTRY, stations, env);
  console.log(`[IE] Refreshed ${stations.length} stations (${petrolStations.length} petrol, ${dieselStations.length} diesel)`);
}
