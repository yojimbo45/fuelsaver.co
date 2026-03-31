import { filterByDistance } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getStations, putStations } from '../lib/kv.js';

const COUNTRY = 'MX';
const API_URL =
  'https://api.datos.gob.mx/v1/precios.gasolinas.gasolinerias';

const FUEL_MAP = {
  precio_regular: 'regular',
  regular: 'regular',
  precio_premium: 'premium',
  premium: 'premium',
  precio_diesel: 'diesel',
  diesel: 'diesel',
};

function normalize(record) {
  const lat = parseFloat(record.latitud ?? record.y);
  const lng = parseFloat(record.longitud ?? record.x);
  if (isNaN(lat) || isNaN(lng)) return null;

  const prices = {};
  for (const [field, label] of Object.entries(FUEL_MAP)) {
    if (record[field] != null) {
      const val = parseFloat(record[field]);
      if (!isNaN(val) && val > 0 && !prices[label]) {
        prices[label] = { price: val };
      }
    }
  }

  if (Object.keys(prices).length === 0) return null;

  const brand = (
    record.razonsocial ||
    record.permisionario ||
    'Station'
  ).trim();

  return {
    id: String(record.place_id ?? record._id ?? ''),
    brand,
    name: brand,
    address: record.direccion || record.calle || '',
    city: record.municipio || '',
    lat,
    lng,
    country: COUNTRY,
    prices,
    updatedAt: record.fecha || null,
  };
}

export async function refresh(env) {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`Mexico API ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const raw = data.results || [];
  const stations = raw.map(normalize).filter(Boolean);

  console.log(`[MX] Fetched ${raw.length} records, normalized ${stations.length} stations`);
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
