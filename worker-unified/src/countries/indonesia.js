/**
 * Indonesia — Government-regulated prices + OpenStreetMap stations.
 *
 * Tier A: fixed national prices (updated monthly by government decree),
 *         station locations from OSM Overpass (grid-cached).
 *
 * Indonesia has regulated fuel prices set by Pertamina/government.
 * Subsidized fuels (Pertalite, BioSolar) are uniform nationwide.
 * Non-subsidized fuels vary slightly by region (~Rp 300-600).
 */

import { filterByDistance, gridCell } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getGridCache, putGridCache } from '../lib/kv.js';
import { queryOverpass } from '../lib/overpass.js';

const COUNTRY = 'ID';

// Current regulated prices (April 2026) — Pertamina nationwide
// Updated monthly on the 1st. Source: mypertamina.id/fuels-harga
const DEFAULT_PRICES = {
  pertalite:      { price: 10000 },  // RON 90, subsidized
  pertamax:       { price: 12300 },  // RON 92
  pertamax_turbo: { price: 14250 },  // RON 98
  solar:          { price: 6800 },   // Diesel 48, subsidized
  dexlite:        { price: 13800 },  // Diesel CN51
};

const BRAND_MAP = {
  pertamina: 'Pertamina', shell: 'Shell', bp: 'BP',
  vivo: 'Vivo', 'total energies': 'TotalEnergies', total: 'TotalEnergies',
  totalenergies: 'TotalEnergies',
};

function mapElements(elements, nationalPrices) {
  return elements.map((el) => {
    const elLat = el.lat || el.center?.lat;
    const elLng = el.lon || el.center?.lon;
    if (!elLat || !elLng) return null;

    const tags = el.tags || {};
    const brand = (tags.brand || tags.operator || tags.name || 'Station').trim();

    return {
      id: `ID-${el.id}`,
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
    // Store default regulated prices — can be enhanced later to scrape
    // isibens.in or mypertamina.id for automatic monthly updates.
    await env.FUEL_KV.put('prices:ID', JSON.stringify(DEFAULT_PRICES));
    console.log(`[ID] Refreshed prices (regulated):`, DEFAULT_PRICES);
  } catch (e) {
    console.error(`[ID] Price refresh failed:`, e);
  }
}

export async function handleQuery(url, env) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const radiusKm = parseFloat(url.searchParams.get('radius') || '15');

  const nationalPrices = await env.FUEL_KV.get('prices:ID', { type: 'json' }) || DEFAULT_PRICES;

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
