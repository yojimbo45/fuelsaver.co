/**
 * Tankerkoenig — DE, HR, LU, PT, SI.
 *
 * Real-time fuel prices via the Tankerkoenig Creative Commons API.
 * Country code is passed as the 3rd argument to handleQuery.
 *
 * Tier B: proxy + grid-cache pattern.
 */

import { filterByDistance, gridCell } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getGridCache, putGridCache } from '../lib/kv.js';

const API_BASE = 'https://creativecommons.tankerkoenig.de/json/list.php';

export async function handleQuery(url, env, countryCode) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const radiusKm = parseFloat(url.searchParams.get('radius') || '15');

  if (!env.TANKERKOENIG_KEY) {
    return json({ error: 'Tankerkoenig API key not configured' }, 503);
  }

  const cc = countryCode.toUpperCase();
  const grid = gridCell(lat, lng);
  const cacheKey = `cache:${cc}:${grid.lat}:${grid.lng}`;

  // Check KV cache
  const cached = await getGridCache(cacheKey, env);
  if (cached) {
    const filtered = filterByDistance(cached, lat, lng, radiusKm);
    return json({ stations: filtered, count: filtered.length });
  }

  // Cache miss — fetch upstream
  const apiUrl = `${API_BASE}?lat=${grid.lat}&lng=${grid.lng}&rad=25&sort=dist&type=all&apikey=${env.TANKERKOENIG_KEY}`;
  const res = await fetch(apiUrl);
  const data = await res.json();

  if (!data.ok) {
    throw new Error(`Tankerkoenig API error: ${data.message || 'unknown'}`);
  }

  // Normalize stations
  const stations = (data.stations || []).map((s) => {
    const prices = {};
    if (s.e5 != null) prices.e5 = s.e5;
    if (s.e10 != null) prices.e10 = s.e10;
    if (s.diesel != null) prices.diesel = s.diesel;

    return {
      id: `${cc}-${s.id}`,
      brand: s.brand || '',
      address: `${s.street || ''} ${s.houseNumber || ''}`.trim(),
      city: `${s.postCode || ''} ${s.place || ''}`.trim(),
      lat: s.lat,
      lng: s.lng,
      prices,
      updatedAt: null,
      isOpen: s.isOpen,
      is24h: s.wholeDay,
    };
  });

  // Store in KV with 5 min TTL
  await putGridCache(cacheKey, stations, env, 300);

  const filtered = filterByDistance(stations, lat, lng, radiusKm);
  return json({ stations: filtered, count: filtered.length });
}
