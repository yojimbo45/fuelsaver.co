import { filterByDistance, gridCell } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getGridCache, putGridCache } from '../lib/kv.js';
import { queryOverpass } from '../lib/overpass.js';

const COUNTRY = 'NZ';

const BRAND_MAP = {
  z: 'Z Energy', 'z energy': 'Z Energy', bp: 'BP', mobil: 'Mobil',
  caltex: 'Caltex', gull: 'Gull', challenge: 'Challenge',
  gas: 'GAS', 'allied petroleum': 'Allied', npd: 'NPD', waitomo: 'Waitomo',
};

function mapElements(elements) {
  return elements.map((el) => {
    const elLat = el.lat || el.center?.lat;
    const elLng = el.lon || el.center?.lon;
    if (!elLat || !elLng) return null;

    const tags = el.tags || {};
    const brand = (tags.brand || tags.name || 'Station').trim();

    return {
      id: `NZ-${el.id}`,
      brand: BRAND_MAP[brand.toLowerCase()] || brand,
      name: tags.name || brand,
      address: [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' '),
      city: tags['addr:suburb'] || tags['addr:city'] || '',
      lat: elLat,
      lng: elLng,
      country: COUNTRY,
      prices: {},
      updatedAt: null,
      is24h: tags.opening_hours === '24/7',
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
    const radiusM = Math.min(radiusKm * 1000, 25000);
    const elements = await queryOverpass(grid.lat, grid.lng, radiusM);
    stations = mapElements(elements);
    await putGridCache(cacheKey, stations, env, 600);
  }

  const filtered = filterByDistance(stations, lat, lng, radiusKm);
  return json({ stations: filtered, count: filtered.length });
}
