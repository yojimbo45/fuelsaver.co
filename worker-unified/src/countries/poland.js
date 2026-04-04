/**
 * Poland — gas.didnt.work API (Waze-sourced).
 * Tier B: proxy + grid-cache pattern.
 */

import { filterByDistance, gridCell } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getGridCache, putGridCache } from '../lib/kv.js';
import { fetchGasDidntWork } from '../lib/gas-didnt-work.js';

const COUNTRY = 'PL';

const FUEL_KEY_MAP = {
  pb95: 'pb95',
  pb98: 'pb98',
  diesel: 'diesel',
  lpg: 'lpg',
  onpolus: 'on_plus',
};

const BRAND_MAP = {
  orlen: 'Orlen',
  bp: 'BP',
  shell: 'Shell',
  'circle k': 'Circle K',
  amic: 'Amic',
  moya: 'Moya',
  lotos: 'Lotos',
  avia: 'AVIA',
  'total energies': 'TotalEnergies',
  totalenergies: 'TotalEnergies',
  mol: 'MOL',
};

export async function handleQuery(url, env) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const radiusKm = parseFloat(url.searchParams.get('radius') || '15');

  const grid = gridCell(lat, lng);
  const cacheKey = `cache:${COUNTRY}:${grid.lat}:${grid.lng}`;

  const cached = await getGridCache(cacheKey, env);
  if (cached && cached.length) {
    const filtered = filterByDistance(cached, lat, lng, radiusKm);
    return json({ stations: filtered, count: filtered.length });
  }

  const stations = await fetchGasDidntWork(grid.lat, grid.lng, COUNTRY, FUEL_KEY_MAP, BRAND_MAP);
  if (stations.length) await putGridCache(cacheKey, stations, env, 600);

  const filtered = filterByDistance(stations, lat, lng, radiusKm);
  return json({ stations: filtered, count: filtered.length });
}
