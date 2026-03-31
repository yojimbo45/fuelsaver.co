import { filterByDistance } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getStations, putStations } from '../lib/kv.js';

const COUNTRY = 'DK';

const PRICES_URL = 'https://beta.q8.dk/Station/GetStationPrices?page=1&pageSize=2000';
const MAP_URL = 'https://www.q8.dk/-/Station/GetGlobalMapStations?appDataSource=bbe79579-212c-498a-b51c-b76702a2cbfe';

// Product IDs to fuel type keys
const PRODUCT_MAP = {
  '1': 'e5',           // GoEasy 95 Extra E5
  '2': 'e10',          // GoEasy 95 E10
  '6': 'diesel',       // GoEasy Diesel
  '8': 'diesel_extra', // GoEasy Diesel Extra
};

// Map brand names between APIs
function normalizeBrand(name) {
  if (!name) return '';
  const n = name.toLowerCase().trim();
  if (n.includes('f24')) return 'F24';
  if (n.includes('q8')) return 'Q8';
  if (n.includes('shell')) return 'Shell';
  return name.trim();
}

// Extract city from price API address format: "Street Number City PostalCode Danmark"
function extractCity(address) {
  if (!address) return '';
  const parts = address.replace(/\s+Danmark\s*$/i, '').trim().split(/\s+/);
  // Last token is postal code (4 digits), second-to-last area is city
  if (parts.length >= 3) {
    const last = parts[parts.length - 1];
    if (/^\d{4}$/.test(last)) {
      // Find city tokens between street and postal code
      return parts.slice(-3, -1).join(' ');
    }
  }
  return '';
}

function matchStations(priceStations, mapStations) {
  const result = [];

  // Index map stations by brand + city for matching
  const mapByBrandCity = new Map();
  for (const ms of mapStations) {
    if (!ms.position?.lat || !ms.position?.lng) continue;
    if (ms.position.lat > 58 || ms.position.lat < 54) continue; // outside Denmark
    const key = `${normalizeBrand(ms.net || ms.type)}:${(ms.city || '').toLowerCase()}`;
    if (!mapByBrandCity.has(key)) mapByBrandCity.set(key, []);
    mapByBrandCity.get(key).push(ms);
  }

  const usedMapIds = new Set();

  for (const ps of priceStations) {
    const brand = normalizeBrand(ps.stationName);
    const city = extractCity(ps.address).toLowerCase();
    const candidates = mapByBrandCity.get(`${brand}:${city}`) || [];

    // Pick first unused candidate
    const match = candidates.find((c) => !usedMapIds.has(c.externalId || c.id));
    if (!match) continue;

    usedMapIds.add(match.externalId || match.id);

    const prices = {};
    for (const p of ps.products || []) {
      const fuelKey = PRODUCT_MAP[String(p.productId)];
      if (fuelKey && p.price != null && p.price > 0) {
        prices[fuelKey] = { price: p.price };
      }
    }

    if (Object.keys(prices).length === 0) continue;

    const latestUpdate = (ps.products || [])
      .map((p) => p.priceChangeDate)
      .filter(Boolean)
      .sort()
      .pop();

    result.push({
      id: `DK-${match.externalId || match.stationNumber || ps.stationId}`,
      brand,
      name: match.name || brand,
      address: match.address || '',
      city: match.city || '',
      lat: match.position.lat,
      lng: match.position.lng,
      country: COUNTRY,
      prices,
      updatedAt: latestUpdate || null,
    });
  }

  // Also add map-only stations (Shell etc.) without prices
  for (const ms of mapStations) {
    if (!ms.position?.lat || !ms.position?.lng) continue;
    if (ms.position.lat > 58 || ms.position.lat < 54) continue;
    const id = ms.externalId || ms.id;
    if (usedMapIds.has(id)) continue;

    result.push({
      id: `DK-${id}`,
      brand: normalizeBrand(ms.net || ms.type),
      name: ms.name || normalizeBrand(ms.net || ms.type),
      address: ms.address || '',
      city: ms.city || '',
      lat: ms.position.lat,
      lng: ms.position.lng,
      country: COUNTRY,
      prices: {},
      updatedAt: null,
    });
  }

  return result;
}

export async function refresh(env) {
  const [pricesRes, mapRes] = await Promise.all([
    fetch(PRICES_URL),
    fetch(MAP_URL),
  ]);

  if (!pricesRes.ok) throw new Error(`DK prices API ${pricesRes.status}`);
  if (!mapRes.ok) throw new Error(`DK map API ${mapRes.status}`);

  const pricesData = await pricesRes.json();
  const mapData = await mapRes.json();

  const priceStations = pricesData?.data?.stationsPrices || [];
  const mapStations = mapData?.stations || [];

  const stations = matchStations(priceStations, mapStations);

  console.log(`[DK] Matched ${stations.length} stations (${priceStations.length} prices, ${mapStations.length} map)`);
  await putStations(COUNTRY, stations, env);
}

export async function handleQuery(url, env) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const radiusKm = parseFloat(url.searchParams.get('radius') || '15');

  const allStations = await getStations(COUNTRY, env);
  if (!allStations) return json({ error: 'Data not yet cached, try again later' }, 503);

  const filtered = filterByDistance(allStations, lat, lng, radiusKm);
  return json({ stations: filtered, count: filtered.length });
}
