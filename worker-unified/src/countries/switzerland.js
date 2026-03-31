/**
 * Switzerland — Navisano / Comparis fuel station API.
 *
 * Returns all ~3,980 Swiss fuel stations with real-time prices.
 * No authentication required.
 *
 * Country code: CH
 */

import { filterByDistance } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getStations, putStations } from '../lib/kv.js';

const NAVISANO_API =
  'https://navisano-prd-fuelprice-api.azurewebsites.net/api/fuelstations';

// ─── Query handler (Tier A pattern) ────────────────────────────────
export async function handleQuery(url, env) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const radiusKm = parseFloat(url.searchParams.get('radius') || '15');

  const allStations = await getStations('CH', env);
  if (!allStations) return json({ error: 'Data not yet cached, try again later' }, 503);

  const filtered = filterByDistance(allStations, lat, lng, radiusKm);
  return json({ stations: filtered, count: filtered.length });
}

// ─── Refresh: fetch upstream, normalise, store in KV ───────────────
export async function refresh(env) {
  const res = await fetch(NAVISANO_API);
  if (!res.ok) {
    throw new Error(`Navisano API returned ${res.status}`);
  }

  const raw = await res.json();
  const list = Array.isArray(raw) ? raw : raw?.data || raw?.stations || [];

  const stations = list
    .map((s) => {
      if (s.isDeleted) return null;

      const sLat = parseFloat(s.location?.lat ?? s.latitude ?? s.lat);
      const sLng = parseFloat(s.location?.lng ?? s.longitude ?? s.lng);
      if (isNaN(sLat) || isNaN(sLng)) return null;

      const prices = {};
      const fc = s.fuelCollection;
      if (fc) {
        if (fc.SP95?.displayPrice != null && !fc.SP95.isDeleted)
          prices.E95 = fc.SP95.displayPrice;
        if (fc.SP98?.displayPrice != null && !fc.SP98.isDeleted)
          prices.E98 = fc.SP98.displayPrice;
        if (fc.DIESEL?.displayPrice != null && !fc.DIESEL.isDeleted)
          prices.Diesel = fc.DIESEL.displayPrice;
      }

      // Find the most recent price update
      let lastUpdate = null;
      for (const fuel of Object.values(fc || {})) {
        const ts = fuel?.fiability?.lastPriceUpdate;
        if (ts && (!lastUpdate || ts > lastUpdate)) lastUpdate = ts;
      }

      if (Object.keys(prices).length === 0) return null;

      return {
        id: s.id || null,
        brand: s.brand || s.displayName || 'Tankstelle',
        address: s.formattedAddress || '',
        city: '',
        lat: sLat,
        lng: sLng,
        prices,
        updatedAt: lastUpdate,
      };
    })
    .filter(Boolean);

  await putStations('CH', stations, env);
  console.log(`[CH] Refreshed ${stations.length} stations`);
}
