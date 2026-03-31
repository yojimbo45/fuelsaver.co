import { filterByDistance } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getStations, putStations } from '../lib/kv.js';

const COUNTRY = 'AR';
const API_URL =
  'https://datos.gob.ar/api/3/action/datastore_search?resource_id=energia-precios-surtidor&limit=5000';

const FUEL_MAP = {
  nafta_super: 'naftaSuper',
  nafta_premium: 'naftaPremium',
  diesel: 'diesel',
  gasoil: 'diesel',
  diesel_premium: 'dieselPremium',
  gnc: 'gnc',
};

function normalize(record) {
  const lat = parseFloat(record.latitud ?? record.lat);
  const lng = parseFloat(record.longitud ?? record.lng ?? record.lon);
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
    record.empresa ||
    record.bandera ||
    'Station'
  ).trim();

  return {
    id: String(record.id_estacion ?? record._id ?? ''),
    brand,
    name: brand,
    address: record.direccion || '',
    city: record.localidad || record.municipio || '',
    lat,
    lng,
    country: COUNTRY,
    prices,
    updatedAt: record.fecha || null,
  };
}

export async function refresh(env) {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`Argentina API ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const raw = data.result?.records || [];
  const stations = raw.map(normalize).filter(Boolean);

  console.log(`[AR] Fetched ${raw.length} records, normalized ${stations.length} stations`);
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
