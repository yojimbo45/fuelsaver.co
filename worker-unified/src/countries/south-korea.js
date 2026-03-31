/**
 * South Korea — OPINET (Korea National Oil Corporation) API.
 *
 * Provides real-time fuel prices from Korean gas stations.
 *
 * Tier B: proxy + grid-cache pattern.
 */

import { filterByDistance, gridCell } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getGridCache, putGridCache } from '../lib/kv.js';

const API_BASE = 'https://www.opinet.co.kr/api/aroundAll.do';

export async function handleQuery(url, env, countryCode) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const radiusKm = parseFloat(url.searchParams.get('radius') || '15');

  if (!env.OPINET_KEY) {
    return json({ error: 'OPINET API key not configured' }, 503);
  }

  const grid = gridCell(lat, lng);
  const cacheKey = `cache:KR:${grid.lat}:${grid.lng}`;

  // Check KV cache
  const cached = await getGridCache(cacheKey, env);
  if (cached) {
    const filtered = filterByDistance(cached, lat, lng, radiusKm);
    return json({ stations: filtered, count: filtered.length });
  }

  // Cache miss — fetch upstream
  const apiUrl = `${API_BASE}?code=${env.OPINET_KEY}&x=${grid.lng}&y=${grid.lat}&radius=5000&sort=2&prodcd=B027&out=json`;
  const res = await fetch(apiUrl);
  const data = await res.json();

  const oilList = data?.RESULT?.OIL || [];

  // Normalize stations
  const stations = oilList.map((s) => {
    const prices = {};
    const fuelKey = s.PRODCD || 'B027';
    if (s.PRICE != null) {
      prices[fuelKey] = s.PRICE;
    }

    return {
      id: `KR-${s.UNI_ID}`,
      brand: s.POLL_DIV_CO || '',
      address: s.NEW_ADR || s.VAN_ADR || '',
      city: '',
      lat: parseFloat(s.GIS_Y_COOR),
      lng: parseFloat(s.GIS_X_COOR),
      prices,
      updatedAt: null,
    };
  });

  // Store in KV with 5 min TTL
  await putGridCache(cacheKey, stations, env, 300);

  const filtered = filterByDistance(stations, lat, lng, radiusKm);
  return json({ stations: filtered, count: filtered.length });
}
