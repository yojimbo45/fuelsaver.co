/**
 * Austria — E-Control Spritpreisrechner API.
 *
 * Fetches all 3 fuel types (SUP, DIE, GAS) in parallel and merges
 * prices per station for a single cache entry.
 *
 * Tier B: proxy + grid-cache pattern.
 */

import { filterByDistance, gridCell } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getGridCache, putGridCache } from '../lib/kv.js';

const API_BASE = 'https://api.e-control.at/sprit/1.0/search/gas-stations/by-address';
const FUEL_TYPES = ['SUP', 'DIE', 'GAS'];

async function fetchForFuelType(lat, lng, fuelType) {
  const url = `${API_BASE}?latitude=${lat}&longitude=${lng}&fuelType=${fuelType}&includeClosed=false`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function mergeStations(resultsByFuel) {
  const stationMap = new Map();

  for (const [fuelType, rawStations] of resultsByFuel) {
    for (const s of rawStations) {
      const loc = s.location || {};
      if (!loc.latitude || !loc.longitude) continue;

      if (!stationMap.has(s.id)) {
        stationMap.set(s.id, {
          id: `AT-${s.id}`,
          brand: s.name || '',
          address: loc.address || '',
          city: `${loc.postalCode || ''} ${loc.city || ''}`.trim(),
          lat: loc.latitude,
          lng: loc.longitude,
          country: 'AT',
          prices: {},
          updatedAt: null,
        });
      }

      const station = stationMap.get(s.id);
      for (const p of s.prices || []) {
        if (p.fuelType && p.amount != null) {
          station.prices[p.fuelType] = p.amount;
        }
      }
    }
  }

  return Array.from(stationMap.values());
}

export async function handleQuery(url, env) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const radiusKm = parseFloat(url.searchParams.get('radius') || '15');

  const grid = gridCell(lat, lng);
  const cacheKey = `cache:AT:${grid.lat}:${grid.lng}`;

  const cached = await getGridCache(cacheKey, env);
  if (cached) {
    const filtered = filterByDistance(cached, lat, lng, radiusKm);
    return json({ stations: filtered, count: filtered.length });
  }

  // Fetch all fuel types in parallel and merge
  const results = await Promise.all(
    FUEL_TYPES.map(async (ft) => [ft, await fetchForFuelType(grid.lat, grid.lng, ft)])
  );

  const stations = mergeStations(results);
  await putGridCache(cacheKey, stations, env, 600);

  const filtered = filterByDistance(stations, lat, lng, radiusKm);
  return json({ stations: filtered, count: filtered.length });
}
