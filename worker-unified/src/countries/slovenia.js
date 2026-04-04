/**
 * Slovenia — goriva.si API (official fuel price data).
 *
 * Paginated JSON API: 25 stations per page, ~22 pages (~552 total).
 * Each station includes inline prices.
 *
 * Tier A: bulk-cache with cron refresh.
 * Country code: SI
 */

import { filterByDistance } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getStations, putStations } from '../lib/kv.js';

const COUNTRY = 'SI';
const API_URL = 'https://goriva.si/api/v1/search/?format=json';
const PAGE_SIZE = 25;

// Fuel types we care about from the goriva.si response
const FUEL_KEYS = ['95', 'dizel', '98', 'avtoplin-lpg'];

// ─── Cron: fetch all pages, normalise, store in KV ──────────────────
export async function refresh(env) {
  const allStations = [];
  let page = 1;

  while (true) {
    const res = await fetch(`${API_URL}&page=${page}`);
    if (!res.ok) throw new Error(`goriva.si API page ${page} returned ${res.status}`);

    const data = await res.json();
    const results = Array.isArray(data) ? data : data.results || [];

    for (const station of results) {
      const normalized = normalize(station);
      if (normalized) allStations.push(normalized);
    }

    if (results.length < PAGE_SIZE) break;
    page++;
  }

  await putStations(COUNTRY, allStations, env);
  console.log(`[SI] Refreshed ${allStations.length} stations (${page} pages)`);
}

// ─── Normalize a single station from the goriva.si API ──────────────
function normalize(station) {
  const lat = station.lat;
  const lng = station.lng;
  if (lat == null || lng == null) return null;

  const prices = {};
  if (station.prices) {
    for (const key of FUEL_KEYS) {
      const val = station.prices[key];
      if (val != null) {
        prices[key] = val;
      }
    }
  }

  return {
    id: `SI-${station.pk}`,
    brand: station.name || 'Station',
    name: station.name || 'Station',
    address: station.address || '',
    city: station.zip_code || '',
    lat,
    lng,
    country: COUNTRY,
    prices,
    updatedAt: null,
  };
}

// ─── Query ──────────────────────────────────────────────────────────
export async function handleQuery(url, env) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const radiusKm = parseFloat(url.searchParams.get('radius') || '15');

  const allStations = await getStations(COUNTRY, env);
  if (!allStations) return json({ error: 'Data not yet cached, try again later' }, 503);

  const filtered = filterByDistance(allStations, lat, lng, radiusKm);
  return json({ stations: filtered, count: filtered.length });
}
