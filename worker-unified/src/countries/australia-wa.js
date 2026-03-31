import { filterByDistance } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getStations, putStations } from '../lib/kv.js';

const COUNTRY = 'WA';
const RSS_BASE = 'https://www.fuelwatch.wa.gov.au/fuelwatch/fuelWatchRSS';

// FuelWatch product codes
const PRODUCTS = [
  { code: 1, key: 'ULP' },
  { code: 2, key: 'PULP95' },
  { code: 4, key: 'diesel' },
  { code: 5, key: 'LPG' },
  { code: 6, key: 'PULP98' },
];

function parseXMLField(xml, tag) {
  const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`);
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

function parseRSSItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const content = match[1];
    const lat = parseFloat(parseXMLField(content, 'latitude'));
    const lng = parseFloat(parseXMLField(content, 'longitude'));
    if (isNaN(lat) || isNaN(lng)) continue;

    items.push({
      tradingName: parseXMLField(content, 'trading-name'),
      brand: parseXMLField(content, 'brand'),
      address: parseXMLField(content, 'address'),
      location: parseXMLField(content, 'location'),
      price: parseFloat(parseXMLField(content, 'price')),
      lat,
      lng,
      date: parseXMLField(content, 'date'),
    });
  }
  return items;
}

export async function refresh(env) {
  const stationMap = new Map();

  const results = await Promise.allSettled(
    PRODUCTS.map(async ({ code, key }) => {
      const res = await fetch(`${RSS_BASE}?Product=${code}&Day=Today`);
      if (!res.ok) return;
      const xml = await res.text();
      const items = parseRSSItems(xml);

      for (const item of items) {
        const stationKey = `${item.lat.toFixed(5)},${item.lng.toFixed(5)}`;
        if (!stationMap.has(stationKey)) {
          stationMap.set(stationKey, {
            id: `WA-${stationKey}`,
            brand: item.brand || item.tradingName || 'Station',
            name: item.tradingName || '',
            address: item.address || '',
            city: item.location || '',
            lat: item.lat,
            lng: item.lng,
            country: 'AU',
            prices: {},
            updatedAt: item.date || null,
          });
        }
        if (!isNaN(item.price) && item.price > 0) {
          stationMap.get(stationKey).prices[key] = { price: item.price };
        }
      }
    })
  );

  const stations = Array.from(stationMap.values());
  console.log(`[WA] Fetched ${stations.length} stations`);
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
