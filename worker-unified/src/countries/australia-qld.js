import { filterByDistance, gridCell } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getGridCache, putGridCache } from '../lib/kv.js';

const COUNTRY = 'QLD';

const CKAN_BASE = 'https://www.data.qld.gov.au/api/3/action/datastore_search_sql';

// Resource IDs for 2026 monthly datasets
// These need updating as new months are added
const RESOURCE_IDS = [
  'f013457b-fd77-4cf0-91e7-28ef983d8c3c', // Feb 2026
  '61a27cfa-9ec5-47cc-8ce5-274f2dcb1908', // Jan 2026
];

// Fuel type normalization
const FUEL_MAP = {
  Unleaded: 'ULP',
  e10: 'E10',
  'PULP 95/96 RON': 'PULP95',
  'PULP 98 RON': 'PULP98',
  Diesel: 'diesel',
  'Premium Diesel': 'diesel_premium',
  LPG: 'LPG',
  e85: 'E85',
};

async function fetchStations(lat, lng, radiusKm) {
  // Query with bounding box (~15km ≈ 0.15°)
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

  const resourceId = RESOURCE_IDS[0]; // Latest month

  const sql = `SELECT * FROM "${resourceId}" WHERE "Site_Latitude" BETWEEN ${lat - latDelta} AND ${lat + latDelta} AND "Site_Longitude" BETWEEN ${lng - lngDelta} AND ${lng + lngDelta} ORDER BY "TransactionDateutc" DESC LIMIT 500`;

  const url = `${CKAN_BASE}?sql=${encodeURIComponent(sql)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`QLD CKAN API ${res.status}`);
  const data = await res.json();

  const records = data?.result?.records || [];

  // Group by SiteId, keeping only the latest record per site+fuel combo
  const siteMap = new Map();
  const seenFuels = new Map(); // key: `SiteId:FuelType` -> latest record

  for (const r of records) {
    const siteId = r.SiteId;
    const fuelKey = `${siteId}:${r.Fuel_Type}`;

    if (!seenFuels.has(fuelKey)) {
      seenFuels.set(fuelKey, r);
    }

    if (!siteMap.has(siteId)) {
      siteMap.set(siteId, {
        id: `QLD-${siteId}`,
        brand: r.Site_Brand || 'Station',
        name: r.Site_Name || '',
        address: r.Sites_Address_Line_1 || '',
        city: r.Site_Suburb || '',
        lat: parseFloat(r.Site_Latitude),
        lng: parseFloat(r.Site_Longitude),
        country: 'AU',
        prices: {},
        updatedAt: r.TransactionDateutc || null,
      });
    }
  }

  // Apply prices from latest records
  for (const [, r] of seenFuels) {
    const station = siteMap.get(r.SiteId);
    if (!station) continue;
    const fuelLabel = FUEL_MAP[r.Fuel_Type] || r.Fuel_Type;
    const price = parseFloat(r.Price);
    if (!isNaN(price) && price > 0) {
      station.prices[fuelLabel] = { price };
    }
  }

  return Array.from(siteMap.values()).filter((s) => !isNaN(s.lat) && !isNaN(s.lng));
}

export async function handleQuery(url, env) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const radiusKm = parseFloat(url.searchParams.get('radius') || '15');

  const grid = gridCell(lat, lng);
  const cacheKey = `cache:${COUNTRY}:${grid.lat}:${grid.lng}`;

  let stations = await getGridCache(cacheKey, env);
  if (!stations) {
    stations = await fetchStations(grid.lat, grid.lng, radiusKm > 15 ? radiusKm : 15);
    await putGridCache(cacheKey, stations, env, 600); // 10-min TTL
  }

  const filtered = filterByDistance(stations, lat, lng, radiusKm);
  return json({ stations: filtered, count: filtered.length });
}
