/**
 * Austria — E-Control Spritpreisrechner API.
 *
 * Open government API for Austrian fuel station prices.
 *
 * Tier B: proxy + grid-cache pattern.
 */

import { filterByDistance, gridCell } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getGridCache, putGridCache } from '../lib/kv.js';

const API_BASE = 'https://api.e-control.at/sprit/1.0/search/gas-stations/by-address';

export async function handleQuery(url, env, countryCode) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const radiusKm = parseFloat(url.searchParams.get('radius') || '15');
  const fuelType = url.searchParams.get('fuelType') || 'SUP';

  const grid = gridCell(lat, lng);
  const cacheKey = `cache:AT:${grid.lat}:${grid.lng}`;

  // Check KV cache
  const cached = await getGridCache(cacheKey, env);
  if (cached) {
    const filtered = filterByDistance(cached, lat, lng, radiusKm);
    return json({ stations: filtered, count: filtered.length });
  }

  // Cache miss — fetch upstream
  const apiUrl = `${API_BASE}?latitude=${grid.lat}&longitude=${grid.lng}&fuelType=${fuelType}&includeClosed=false`;
  const res = await fetch(apiUrl);
  const data = await res.json();

  // Normalize stations — response is an array
  const rawStations = Array.isArray(data) ? data : [];
  const stations = rawStations.map((s) => {
    const loc = s.location || {};
    const prices = {};
    for (const p of s.prices || []) {
      if (p.fuelType && p.amount != null) {
        prices[p.fuelType] = p.amount;
      }
    }

    return {
      id: `AT-${s.id}`,
      brand: s.name || '',
      address: loc.address || '',
      city: `${loc.postalCode || ''} ${loc.city || ''}`.trim(),
      lat: loc.latitude,
      lng: loc.longitude,
      prices,
      updatedAt: null,
    };
  });

  // Store in KV with 10 min TTL
  await putGridCache(cacheKey, stations, env, 600);

  const filtered = filterByDistance(stations, lat, lng, radiusKm);
  return json({ stations: filtered, count: filtered.length });
}
