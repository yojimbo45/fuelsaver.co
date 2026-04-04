/**
 * Croatia — mzoe-gor.hr (Ministry of Economy) open data.
 *
 * Single JSON endpoint with all ~911 stations and current prices.
 * CRITICAL: lat/lng are SWAPPED in the source data!
 *   - "long" field = actual latitude
 *   - "lat" field  = actual longitude
 * (confirmed by the source website's own JS: t.state = {lat: e.postaja.long, lng: e.postaja.lat})
 *
 * Country code: HR
 */

import { filterByDistance } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getStations, putStations } from '../lib/kv.js';

const COUNTRY = 'HR';
const API_URL = 'https://mzoe-gor.hr/data.json';

// Legal entity → consumer brand name (for logo resolution)
const BRAND_MAP = {
  'ina – industrija nafte d.d.': 'INA',
  'petrol d.o.o.': 'Petrol',
  'tifon d.o.o.': 'Tifon',
  'lukoil croatia d.o.o.': 'Lukoil',
  'coral croatia d.o.o.': 'Shell',
  'adria oil d.o.o.': 'BP',
  'ktc d.d.': 'KTC',
  'ags hrvatska d.o.o.': 'AGS',
  'crodux derivati dva d.o.o.': 'Crodux',
  'mol hrvatska d.o.o.': 'MOL',
  'omv hrvatska d.o.o.': 'OMV',
};

function normalizeBrand(name) {
  if (!name) return 'Station';
  return BRAND_MAP[name.toLowerCase().trim()] || name.split(/\s*[–-]\s*/)[0].trim();
}

// vrsta_goriva_id → normalised fuel type
const FUEL_TYPE_MAP = {
  1: 'eurosuper95',    // Eurosuper 95 sa aditivima
  2: 'eurosuper95',    // Eurosuper 95 bez aditiva
  5: 'eurosuper100',   // Eurosuper 100 sa aditivima
  6: 'eurosuper100',   // Eurosuper 100 bez aditiva
  7: 'eurodizel',      // Eurodizel sa aditivima
  8: 'eurodizel',      // Eurodizel bez aditiva
  9: 'lpg',            // UNP (autoplin)
};

// ─── Refresh: fetch upstream, normalise, store in KV ───────────────
export async function refresh(env) {
  const res = await fetch(API_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FuelSaver/1.0)' },
  });
  if (!res.ok) throw new Error(`Croatia API returned ${res.status}`);

  const data = await res.json();
  const { postajas = [], gorivos = [], obvezniks = [] } = data;

  // Build lookup: gorivo_id → vrsta_goriva_id
  const gorivoToVrsta = new Map();
  for (const g of gorivos) {
    gorivoToVrsta.set(g.id, g.vrsta_goriva_id);
  }

  // Build lookup: obveznik_id → brand name
  const obveznikToBrand = new Map();
  for (const o of obvezniks) {
    obveznikToBrand.set(o.id, o.naziv);
  }

  const stations = [];

  for (const s of postajas) {
    // SWAP: "long" is actually latitude, "lat" is actually longitude
    const lat = parseFloat(s.long);
    const lng = parseFloat(s.lat);

    // Validate coordinates are within Croatia bounds
    if (isNaN(lat) || isNaN(lng) || lat < 42 || lat > 47 || lng < 13 || lng > 20) continue;

    const rawBrand = obveznikToBrand.get(s.obveznik_id) || '';
    const brand = normalizeBrand(rawBrand);

    // Process prices: gorivo_id → vrsta_goriva_id → fuel type string
    const prices = {};
    for (const c of (s.cjenici || [])) {
      const vrstaId = gorivoToVrsta.get(c.gorivo_id);
      if (vrstaId == null) continue;

      const fuelType = FUEL_TYPE_MAP[vrstaId];
      if (!fuelType) continue;

      const price = c.cijena;
      if (typeof price !== 'number' || price <= 0 || price > 5) continue;

      // If multiple products map to the same fuel type, keep the cheapest
      if (prices[fuelType] == null || price < prices[fuelType]) {
        prices[fuelType] = price;
      }
    }

    stations.push({
      id: `HR-${s.id}`,
      brand,
      name: s.naziv || brand,
      address: s.adresa || '',
      city: s.mjesto || '',
      lat,
      lng,
      country: COUNTRY,
      prices,
      updatedAt: null,
    });
  }

  await putStations(COUNTRY, stations, env);
  console.log(`[HR] Refreshed ${stations.length} stations`);
}

// ─── Query handler (Tier A pattern) ────────────────────────────────
export async function handleQuery(url, env) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const radiusKm = parseFloat(url.searchParams.get('radius') || '15');

  const allStations = await getStations(COUNTRY, env);
  if (!allStations) return json({ error: 'Data not yet cached, try again later' }, 503);

  const filtered = filterByDistance(allStations, lat, lng, radiusKm);
  return json({ stations: filtered, count: filtered.length });
}
