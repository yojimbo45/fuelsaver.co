import { filterByDistance } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getStations, putStations } from '../lib/kv.js';

const COUNTRY = 'PT';
const API_BASE = 'https://precoscombustiveis.dgeg.gov.pt/api/PrecoComb/';

/**
 * Fuel type IDs used by the DGEG API, mapped to our internal labels.
 */
const FUEL_TYPES = [
  { id: '3201', label: 'gasolina_95' },
  { id: '2101', label: 'gasoleo' },
  { id: '2105', label: 'gasoleo_especial' },
  { id: '1120', label: 'gpl' },
];

/** Mainland Portugal districts (IDs 1–18). */
const DISTRICT_IDS = Array.from({ length: 18 }, (_, i) => i + 1);

/**
 * Parse DGEG price string "1,959 EUR" → 1.959
 */
function parsePrice(raw) {
  if (!raw || typeof raw !== 'string') return NaN;
  const numeric = raw.split(' ')[0];
  return parseFloat(numeric.replace(',', '.'));
}

/**
 * Fetch a single district + fuel type from the DGEG search endpoint.
 * Returns an array of raw station objects, or [] on failure.
 */
async function fetchDistrict(fuelId, districtId) {
  const url =
    `${API_BASE}PesquisarPostos?idsCombustiveis=${fuelId}` +
    `&idDistrito=${districtId}&idMarca=&idTipoPosto=` +
    `&idsMunicipios=&qtdPorPagina=1500&pagina=1`;

  const res = await fetch(url);
  if (!res.ok) return [];

  const data = await res.json();
  if (!data.status || !Array.isArray(data.resultado)) return [];
  return data.resultado;
}

// ─── Cron: bulk-fetch all stations from DGEG ────────────────────────
export async function refresh(env) {
  // Map keyed by DGEG station Id → merged station object
  const stationMap = new Map();

  // Process one fuel type at a time (sequential), all 18 districts in parallel
  for (const fuel of FUEL_TYPES) {
    const results = await Promise.allSettled(
      DISTRICT_IDS.map((districtId) => fetchDistrict(fuel.id, districtId))
    );

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;

      for (const record of result.value) {
        const id = record.Id;
        if (id == null) continue;

        const price = parsePrice(record.Preco);
        if (isNaN(price) || price <= 0) continue;

        const lat = record.Latitude;
        const lng = record.Longitude;
        if (lat == null || lng == null) continue;

        if (stationMap.has(id)) {
          // Merge this fuel price into the existing entry
          stationMap.get(id).prices[fuel.label] = { price };
          // Keep the most recent update timestamp
          if (record.DataAtualizacao) {
            const existing = stationMap.get(id).updatedAt || '';
            if (record.DataAtualizacao > existing) {
              stationMap.get(id).updatedAt = record.DataAtualizacao;
            }
          }
        } else {
          stationMap.set(id, {
            id: `PT-${id}`,
            brand: record.Marca || 'Station',
            name: record.Nome || record.Marca || 'Station',
            address: record.Morada || '',
            city: record.Localidade || record.Municipio || '',
            lat,
            lng,
            country: COUNTRY,
            prices: { [fuel.label]: { price } },
            updatedAt: record.DataAtualizacao || null,
          });
        }
      }
    }
  }

  const stations = [...stationMap.values()];
  await putStations(COUNTRY, stations, env);
  console.log(`[PT] Refreshed ${stations.length} stations from DGEG`);
}

// ─── Query ──────────────────────────────────────────────────────────
export async function handleQuery(url, env) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const radiusKm = parseFloat(url.searchParams.get('radius') || '15');

  const allStations = await getStations(COUNTRY, env);
  if (!allStations) return json({ error: 'Data not yet cached, try again later' }, 503);

  const filtered = filterByDistance(allStations, lat, lng, radiusKm);
  return json({ stations: filtered, count: filtered.length });
}
