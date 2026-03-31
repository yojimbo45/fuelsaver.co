import { filterByDistance, gridCell } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getGridCache, putGridCache } from '../lib/kv.js';

const COUNTRY = 'NL';

const API_BASE = 'https://www.brandstof-zoeker.nl/ajax/stations/';
const FUEL_TYPES = ['euro95', 'diesel', 'lpg'];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; FuelSaver/1.0)',
  'X-Requested-With': 'XMLHttpRequest',
  'Referer': 'https://www.brandstof-zoeker.nl/',
};

async function fetchStationsForType(lat, lng, fuelType) {
  // Radius is in degrees — 0.09 ≈ 10km
  const url = `${API_BASE}?pageType=geo%2FpostalCode&type=${fuelType}&latitude=${lat}&longitude=${lng}&radius=0.15`;

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return [];
  const data = await res.json();

  return (Array.isArray(data) ? data : []).map((item) => {
    const s = item.station || {};
    const fp = item.fuelPrice || {};
    if (!s.latitude || !s.longitude) return null;

    return {
      stationId: s.id,
      brand: s.chain || s.naam || 'Station',
      name: s.naam || '',
      address: s.adres || '',
      city: `${s.postcode || ''} ${s.plaats || ''}`.trim(),
      lat: s.latitude,
      lng: s.longitude,
      fuelType: fp.tech || fuelType,
      price: fp.prijs ? parseFloat(fp.prijs) : null,
      updatedAt: fp.datum || null,
    };
  }).filter(Boolean);
}

async function fetchAllFuels(lat, lng) {
  const results = await Promise.all(
    FUEL_TYPES.map((ft) => fetchStationsForType(lat, lng, ft))
  );

  // Merge by station ID
  const stationMap = new Map();
  for (const stationList of results) {
    for (const s of stationList) {
      if (!stationMap.has(s.stationId)) {
        stationMap.set(s.stationId, {
          id: `NL-${s.stationId}`,
          brand: s.brand,
          name: s.name,
          address: s.address,
          city: s.city,
          lat: s.lat,
          lng: s.lng,
          country: COUNTRY,
          prices: {},
          updatedAt: s.updatedAt,
        });
      }
      const station = stationMap.get(s.stationId);
      if (s.price != null && s.price > 0) {
        station.prices[s.fuelType] = { price: s.price };
      }
    }
  }

  return Array.from(stationMap.values());
}

export async function handleQuery(url, env) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const radiusKm = parseFloat(url.searchParams.get('radius') || '15');

  const grid = gridCell(lat, lng);
  const cacheKey = `cache:${COUNTRY}:${grid.lat}:${grid.lng}`;

  let stations = await getGridCache(cacheKey, env);
  if (!stations) {
    stations = await fetchAllFuels(grid.lat, grid.lng);
    await putGridCache(cacheKey, stations, env, 300); // 5-min TTL
  }

  const filtered = filterByDistance(stations, lat, lng, radiusKm);
  return json({ stations: filtered, count: filtered.length });
}
