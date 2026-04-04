/**
 * Thailand — Bangchak REST API (prices) + OpenStreetMap (stations).
 *
 * Tier A: bulk-cached national prices refreshed via cron,
 *         station locations from OSM Overpass (grid-cached).
 *
 * Prices are uniform nationwide per fuel type (minor district variation ignored).
 * Bangchak API: https://oil-price.bangchak.co.th/ApiOilPrice2/en — free, no key.
 */

import { filterByDistance, gridCell } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getGridCache, putGridCache } from '../lib/kv.js';
import { queryOverpass } from '../lib/overpass.js';

const COUNTRY = 'TH';

const PRICE_API = 'https://oil-price.bangchak.co.th/ApiOilPrice2/en';

// Map Bangchak OilName → our fuel type IDs (must match countries.js fuelTypes)
const FUEL_NAME_MAP = {
  'gasohol 95 s evo': 'gasohol95',
  'gasohol 91 s evo': 'gasohol91',
  'gasohol e20 s evo': 'e20',
  'hi premium diesel s': 'diesel_premium',
  'hi diesel s': 'diesel',
  'hi premium 97 gasohol 95': 'gasohol95_premium',
  'gasohol e85 s evo': 'e85',
};

const BRAND_MAP = {
  ptt: 'PTT', 'ป.ต.ท.': 'PTT', 'ปตท.': 'PTT', 'ปตท': 'PTT',
  bangchak: 'Bangchak', 'บางจาก': 'Bangchak',
  shell: 'Shell', 'เชลล์': 'Shell',
  esso: 'Esso', 'เอสโซ่': 'Esso',
  caltex: 'Caltex', 'คาลเท็กซ์': 'Caltex',
  pt: 'PT', susco: 'Susco', 'ซัสโก้': 'Susco',
  tela: 'Tela',
};

function mapElements(elements, nationalPrices) {
  return elements.map((el) => {
    const elLat = el.lat || el.center?.lat;
    const elLng = el.lon || el.center?.lon;
    if (!elLat || !elLng) return null;

    const tags = el.tags || {};
    const brand = (tags.brand || tags.name || 'Station').trim();

    return {
      id: `TH-${el.id}`,
      brand: BRAND_MAP[brand.toLowerCase()] || BRAND_MAP[brand] || brand,
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
    if (!res.ok) throw new Error(`Bangchak API ${res.status}`);
    const data = await res.json();

    const entry = Array.isArray(data) ? data[0] : data;
    if (!entry || !entry.OilList) return;

    // OilList is a JSON string inside the JSON response
    const oilList = typeof entry.OilList === 'string' ? JSON.parse(entry.OilList) : entry.OilList;

    const prices = {};
    for (const item of oilList) {
      const name = (item.OilName || '').toLowerCase().trim();
      const fuelId = FUEL_NAME_MAP[name];
      if (fuelId && item.PriceToday != null) {
        prices[fuelId] = { price: parseFloat(item.PriceToday) };
      }
    }

    await env.FUEL_KV.put('prices:TH', JSON.stringify(prices));
    console.log(`[TH] Refreshed prices:`, prices);
  } catch (e) {
    console.error(`[TH] Price refresh failed:`, e);
  }
}

export async function handleQuery(url, env) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const radiusKm = parseFloat(url.searchParams.get('radius') || '15');

  const nationalPrices = await env.FUEL_KV.get('prices:TH', { type: 'json' }) || {};

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
