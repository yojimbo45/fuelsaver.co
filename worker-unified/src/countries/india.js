import { filterByDistance, gridCell } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getGridCache, putGridCache } from '../lib/kv.js';
import { queryOverpass } from '../lib/overpass.js';

const COUNTRY = 'IN';

const BRAND_MAP = {
  'indian oil': 'Indian Oil', 'indianoil': 'Indian Oil', iocl: 'Indian Oil',
  'bharat petroleum': 'BPCL', bpcl: 'BPCL',
  'hindustan petroleum': 'HPCL', hpcl: 'HPCL', hp: 'HPCL',
  reliance: 'Reliance', shell: 'Shell', nayara: 'Nayara Energy',
  essar: 'Nayara Energy',
};

function mapElements(elements) {
  return elements.map((el) => {
    const elLat = el.lat || el.center?.lat;
    const elLng = el.lon || el.center?.lon;
    if (!elLat || !elLng) return null;
    const tags = el.tags || {};
    const brand = (tags.brand || tags.name || 'Station').trim();
    return {
      id: `IN-${el.id}`,
      brand: BRAND_MAP[brand.toLowerCase()] || brand,
      name: tags.name || brand,
      address: [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' '),
      city: tags['addr:city'] || tags['addr:suburb'] || '',
      lat: elLat, lng: elLng, country: COUNTRY, prices: {}, updatedAt: null,
    };
  }).filter(Boolean);
}

export async function handleQuery(url, env) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const radiusKm = parseFloat(url.searchParams.get('radius') || '15');
  const grid = gridCell(lat, lng);
  const cacheKey = `cache:${COUNTRY}:${grid.lat}:${grid.lng}`;
  let stations = await getGridCache(cacheKey, env);
  if (!stations) {
    const elements = await queryOverpass(grid.lat, grid.lng, Math.min(radiusKm * 1000, 25000));
    stations = mapElements(elements);
    await putGridCache(cacheKey, stations, env, 600);
  }
  const filtered = filterByDistance(stations, lat, lng, radiusKm);
  return json({ stations: filtered, count: filtered.length });
}
