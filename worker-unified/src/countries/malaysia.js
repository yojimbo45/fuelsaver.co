import { filterByDistance, gridCell } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getGridCache, putGridCache } from '../lib/kv.js';
import { queryOverpass } from '../lib/overpass.js';

const COUNTRY = 'MY';

// Malaysia has uniform nationwide fuel prices set weekly by the government
const PRICE_API = 'https://api.data.gov.my/data-catalogue?id=fuelprice&sort=-date&limit=1';

const BRAND_MAP = {
  petronas: 'Petronas', shell: 'Shell', 'petron malaysia': 'Petron',
  petron: 'Petron', bp: 'BHPetrol', bhpetrol: 'BHPetrol', caltex: 'Caltex',
};

function mapElements(elements, nationalPrices) {
  return elements.map((el) => {
    const elLat = el.lat || el.center?.lat;
    const elLng = el.lon || el.center?.lon;
    if (!elLat || !elLng) return null;

    const tags = el.tags || {};
    const brand = (tags.brand || tags.name || 'Station').trim();

    return {
      id: `MY-${el.id}`,
      brand: BRAND_MAP[brand.toLowerCase()] || brand,
      name: tags.name || brand,
      address: [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' '),
      city: tags['addr:city'] || tags['addr:suburb'] || '',
      lat: elLat,
      lng: elLng,
      country: COUNTRY,
      prices: nationalPrices,
      updatedAt: null,
    };
  }).filter(Boolean);
}

export async function refresh(env) {
  try {
    const res = await fetch(PRICE_API);
    if (!res.ok) throw new Error(`Malaysia price API ${res.status}`);
    const data = await res.json();
    const latest = Array.isArray(data) ? data[0] : data;
    if (!latest) return;

    const prices = {};
    if (latest.ron95 != null) prices.RON95 = { price: parseFloat(latest.ron95) };
    if (latest.ron97 != null) prices.RON97 = { price: parseFloat(latest.ron97) };
    if (latest.diesel != null) prices.diesel = { price: parseFloat(latest.diesel) };

    await env.FUEL_KV.put('prices:MY', JSON.stringify(prices));
    console.log(`[MY] Refreshed prices:`, prices);
  } catch (e) {
    console.error(`[MY] Price refresh failed:`, e);
  }
}

export async function handleQuery(url, env) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const radiusKm = parseFloat(url.searchParams.get('radius') || '15');

  const nationalPrices = await env.FUEL_KV.get('prices:MY', { type: 'json' }) || {};

  const grid = gridCell(lat, lng);
  const cacheKey = `cache:${COUNTRY}:${grid.lat}:${grid.lng}`;

  let stations = await getGridCache(cacheKey, env);
  if (!stations) {
    const radiusM = Math.min(radiusKm * 1000, 25000);
    const elements = await queryOverpass(grid.lat, grid.lng, radiusM);
    stations = mapElements(elements, nationalPrices);
    await putGridCache(cacheKey, stations, env, 3600);
  }

  const filtered = filterByDistance(stations, lat, lng, radiusKm);
  return json({ stations: filtered, count: filtered.length });
}
