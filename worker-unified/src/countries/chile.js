import { filterByDistance } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getStations, putStations } from '../lib/kv.js';

const COUNTRY = 'CL';
const API_URL = 'https://api.cne.cl/v3/combustibles/vehicular/estaciones';

const FUEL_MAP = {
  gasolina_93: 'gasolina93',
  gasolina_95: 'gasolina95',
  gasolina_97: 'gasolina97',
  diesel: 'diesel',
  petroleo_diesel: 'diesel',
  glp: 'glp',
  glp_vehicular: 'glp',
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
    record.distribuidor ||
    record.nombre_distribuidor ||
    'Station'
  ).trim();

  return {
    id: String(record.id ?? record.id_estacion ?? ''),
    brand,
    name: brand,
    address: record.direccion_calle || record.direccion || '',
    city: record.comuna || record.nombre_comuna || '',
    lat,
    lng,
    country: COUNTRY,
    prices,
    updatedAt: record.fecha_actualizacion || null,
  };
}

export async function refresh(env) {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`Chile API ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const raw = Array.isArray(data) ? data : data.data || [];
  const stations = raw.map(normalize).filter(Boolean);

  console.log(`[CL] Fetched ${raw.length} records, normalized ${stations.length} stations`);
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
