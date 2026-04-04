import { filterByDistance, gridCell } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getGridCache, putGridCache } from '../lib/kv.js';
import { scrapeCarbuStations } from '../lib/carbu.js';

const COUNTRY = 'BE';
const FUEL_MAP = { GO: 'diesel', E10: 'E10', SP98: 'SP98' };

export async function handleQuery(url, env) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const radiusKm = parseFloat(url.searchParams.get('radius') || '15');

  const grid = gridCell(lat, lng);
  const cacheKey = `cache:${COUNTRY}:${grid.lat}:${grid.lng}`;

  let stations = await getGridCache(cacheKey, env);
  if (!stations) {
    stations = await scrapeCarbuStations('belgie', grid.lat, grid.lng, FUEL_MAP);

    // Tag each station with country code and prefixed ID
    stations = stations.map((s) => ({
      ...s,
      country: COUNTRY,
      id: s.id.startsWith('BE-') ? s.id : `BE-${s.id}`,
    }));

    await putGridCache(cacheKey, stations, env, 600);
  }

  const filtered = filterByDistance(stations, lat, lng, radiusKm);
  return json({ stations: filtered, count: filtered.length });
}
