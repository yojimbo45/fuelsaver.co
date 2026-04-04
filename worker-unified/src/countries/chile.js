import { filterByDistance } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getStations, putStations } from '../lib/kv.js';

const COUNTRY = 'CL';
const API_URL = 'https://api.bencinaenlinea.cl/api/busqueda_estacion_filtro';

const FUEL_MAP = {
  '93': 'gasolina93',
  'A93': 'gasolina93',
  '95': 'gasolina95',
  'A95': 'gasolina95',
  '97': 'gasolina97',
  'A97': 'gasolina97',
  'DI': 'diesel',
  'ADI': 'diesel',
  'GLP': 'glp',
  'GNC': 'gnc',
  'KE': 'kerosene',
};

function normalize(record) {
  const lat = parseFloat(record.latitud);
  const lng = parseFloat(record.longitud);
  if (isNaN(lat) || isNaN(lng)) return null;

  const prices = {};
  let latestDate = null;

  if (Array.isArray(record.combustibles)) {
    for (const c of record.combustibles) {
      const label = FUEL_MAP[c.nombre_corto];
      if (!label) continue;

      const val = parseFloat(c.precio);
      if (isNaN(val) || val <= 0) continue;

      // Keep the lowest price per fuel type (self-service vs attended)
      if (!prices[label] || val < prices[label].price) {
        prices[label] = { price: val };
      }

      if (c.precio_fecha && (!latestDate || c.precio_fecha > latestDate)) {
        latestDate = c.precio_fecha;
      }
    }
  }

  if (Object.keys(prices).length === 0) return null;

  return {
    id: String(record.id ?? ''),
    brand: '',
    name: record.direccion || '',
    address: record.direccion || '',
    city: record.comuna || '',
    lat,
    lng,
    country: COUNTRY,
    logo: record.logo || null,
    prices,
    updatedAt: latestDate,
  };
}

export async function refresh(env) {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`Chile API ${res.status}: ${await res.text()}`);

  const body = await res.json();
  const raw = body.data || (Array.isArray(body) ? body : []);
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
