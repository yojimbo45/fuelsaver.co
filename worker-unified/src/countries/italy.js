/**
 * Italy — MIMIT open data (Ministry of Industry).
 *
 * Two pipe-separated CSVs fetched in parallel:
 *   - anagrafica_impianti_attivi.csv  (station registry)
 *   - prezzo_alle_8.csv              (daily prices at 08:00)
 *
 * Country code: IT
 */

import { filterByDistance } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getStations, putStations } from '../lib/kv.js';

const ANAGRAFICA_URL =
  'https://www.mimit.gov.it/images/exportCSV/anagrafica_impianti_attivi.csv';
const PREZZI_URL =
  'https://www.mimit.gov.it/images/exportCSV/prezzo_alle_8.csv';

// ─── Query handler (Tier A pattern) ────────────────────────────────
export async function handleQuery(url, env) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const radiusKm = parseFloat(url.searchParams.get('radius') || '15');

  const allStations = await getStations('IT', env);
  if (!allStations) return json({ error: 'Data not yet cached, try again later' }, 503);

  const filtered = filterByDistance(allStations, lat, lng, radiusKm);
  return json({ stations: filtered, count: filtered.length });
}

// ─── Refresh: fetch upstream, normalise, store in KV ───────────────
export async function refresh(env) {
  const [anagText, prezziText] = await Promise.all([
    fetch(ANAGRAFICA_URL).then((r) => {
      if (!r.ok) throw new Error(`Anagrafica CSV returned ${r.status}`);
      return r.text();
    }),
    fetch(PREZZI_URL).then((r) => {
      if (!r.ok) throw new Error(`Prezzi CSV returned ${r.status}`);
      return r.text();
    }),
  ]);

  // Parse station registry
  const stationMap = parseAnagrafica(anagText);

  // Parse prices and merge into stations
  parsePrezzi(prezziText, stationMap);

  // Collect stations that have at least one price
  const stations = [];
  for (const s of stationMap.values()) {
    if (Object.keys(s.prices).length > 0) {
      stations.push(s);
    }
  }

  await putStations('IT', stations, env);
  console.log(`[IT] Refreshed ${stations.length} stations`);
}

// ─── CSV parsers ────────────────────────────────────────────────────

/**
 * Anagrafica CSV columns (pipe-separated, first line is date header):
 * idImpianto|Gestore|Bandiera|Tipo Impianto|Nome Impianto|Indirizzo|Comune|Provincia|Latitudine|Longitudine
 */
function parseAnagrafica(text) {
  const map = new Map();
  const lines = text.split('\n');

  // First line is "Estrazione del YYYY-MM-DD", second is column headers, data starts at line 3
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = splitCSVLine(line, '|');
    if (cols.length < 10) continue;

    const id = cols[0].trim();
    const lat = parseFloat(cols[8].replace(',', '.'));
    const lng = parseFloat(cols[9].replace(',', '.'));
    if (!id || isNaN(lat) || isNaN(lng)) continue;

    // Skip obviously wrong coordinates (outside Italy bounding box)
    if (lat < 35 || lat > 48 || lng < 6 || lng > 19) continue;

    map.set(id, {
      id,
      brand: cols[2].trim() || cols[1].trim() || 'Distributore',
      address: cols[5].trim(),
      city: cols[6].trim(),
      lat,
      lng,
      prices: {},
      updatedAt: null,
    });
  }

  return map;
}

/**
 * Prezzi CSV columns (pipe-separated, first line is date header):
 * idImpianto|descCarburante|prezzo|isSelf|dtComu
 */
function parsePrezzi(text, stationMap) {
  const lines = text.split('\n');

  // Fuel type mapping to our standard keys
  const FUEL_MAP = {
    'benzina': 'benzina',
    'gasolio': 'gasolio',
    'gpl': 'gpl',
    'metano': 'metano',
    'benzina special': 'benzina',
    'gasolio speciale': 'gasolio',
    'gasolio artico': 'gasolio',
    'gasolio alpino': 'gasolio',
    'gnl': 'metano',
    'l-gnc': 'metano',
  };

  // First line is "Estrazione del YYYY-MM-DD", second is column headers, data starts at line 3
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = splitCSVLine(line, '|');
    if (cols.length < 5) continue;

    const id = cols[0].trim();
    const station = stationMap.get(id);
    if (!station) continue;

    const rawFuel = cols[1].trim().toLowerCase();
    const price = parseFloat(cols[2].replace(',', '.'));
    const isSelf = cols[3].trim() === '1';
    const dateStr = cols[4].trim();

    if (isNaN(price) || price <= 0 || price > 10) continue;

    const fuelKey = FUEL_MAP[rawFuel];
    if (!fuelKey) continue;

    // Prefer self-service prices (cheaper); only overwrite if current is not self-service
    const existingPrice = station.prices[fuelKey];
    if (existingPrice == null || isSelf) {
      station.prices[fuelKey] = price;
    }

    // Track most recent update
    if (dateStr && (!station.updatedAt || dateStr > station.updatedAt)) {
      station.updatedAt = dateStr;
    }
  }
}

/**
 * Split a CSV line respecting quoted fields.
 */
function splitCSVLine(line, sep) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === sep && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
