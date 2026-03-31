import { filterByDistance } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getStations, putStations } from '../lib/kv.js';

const COUNTRY = 'ES';
const API_URL =
  'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/';

/**
 * Spanish API uses comma as decimal separator.
 */
function parseCommaFloat(val) {
  if (val == null || val === '') return NaN;
  return parseFloat(String(val).replace(',', '.'));
}

const FUEL_MAP = {
  'Precio Gasolina 95 E5': 'gasolina95',
  'Precio Gasolina 98 E5': 'gasolina98',
  'Precio Gasoleo A': 'gasoleo',
  'Precio Gases licuados del petróleo': 'glp',
};

function normalize(record) {
  const lat = parseCommaFloat(record['Latitud']);
  const lng = parseCommaFloat(record['Longitud (WGS84)'] || record['Longitud']);
  if (isNaN(lat) || isNaN(lng)) return null;

  const prices = {};
  for (const [field, label] of Object.entries(FUEL_MAP)) {
    const val = parseCommaFloat(record[field]);
    if (!isNaN(val) && val > 0) {
      prices[label] = { price: val };
    }
  }

  if (Object.keys(prices).length === 0) return null;

  return {
    id: String(record['IDEESS'] || ''),
    brand: (record['Rótulo'] || 'Station').trim(),
    name: (record['Rótulo'] || 'Station').trim(),
    address: record['Dirección'] || '',
    city: record['Municipio'] || '',
    lat,
    lng,
    country: COUNTRY,
    prices,
  };
}

export async function refresh(env) {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`Spain API ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const raw = data.ListaEESSPrecio || [];
  const stations = raw.map(normalize).filter(Boolean);

  console.log(`[ES] Fetched ${raw.length} records, normalized ${stations.length} stations`);
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
