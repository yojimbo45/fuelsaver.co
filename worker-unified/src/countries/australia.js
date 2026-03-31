/**
 * Australia — multi-state router.
 *
 * Detects the Australian state from coordinates and delegates to the
 * appropriate state-specific handler (NSW, QLD, WA).
 * Falls back to NSW (FuelCheck) for states without a dedicated handler.
 */

import { filterByDistance, gridCell } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getGridCache, putGridCache } from '../lib/kv.js';
import * as australiaWA from './australia-wa.js';
import * as australiaQLD from './australia-qld.js';

// Simplified bounding boxes for Australian states
function detectState(lat, lng) {
  // WA: west of ~129°E
  if (lng < 129) return 'WA';
  // QLD: north of ~29°S and east of 138°E
  if (lat > -29 && lng > 138) return 'QLD';
  // NSW: roughly between -29 and -37.5, east of 141
  if (lat > -37.5 && lat <= -28 && lng > 141) return 'NSW';
  // VIC: south of -36, east of 141 (no dedicated handler yet)
  if (lat <= -36 && lng > 141 && lng < 150) return 'VIC';
  // SA: between 129 and 141
  if (lng >= 129 && lng < 141) return 'SA';
  // TAS: south of -40
  if (lat < -40) return 'TAS';
  // NT: north of -26, between 129 and 138
  if (lat > -26 && lng >= 129 && lng < 138) return 'NT';
  // Default to NSW
  return 'NSW';
}

// NSW FuelCheck handler (original)
const NSW_API_URL = 'https://api.onegov.nsw.gov.au/FuelCheckApp/v2/fuel/prices/nearby';

async function handleNSW(url, env) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const radiusKm = parseFloat(url.searchParams.get('radius') || '15');
  const fuelType = url.searchParams.get('fuelType') || 'E10';

  if (!env.FUELCHECK_NSW_KEY) {
    return json({ error: 'FuelCheck NSW API key not configured' }, 503);
  }

  const grid = gridCell(lat, lng);
  const cacheKey = `cache:AU-NSW:${grid.lat}:${grid.lng}`;

  const cached = await getGridCache(cacheKey, env);
  if (cached) {
    const filtered = filterByDistance(cached, lat, lng, radiusKm);
    return json({ stations: filtered, count: filtered.length });
  }

  const body = {
    fuelType,
    latitude: grid.lat,
    longitude: grid.lng,
    radius: 50,
    sortBy: 'distance',
    sortAscending: true,
  };

  const res = await fetch(NSW_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(env.FUELCHECK_NSW_KEY + ':' + (env.FUELCHECK_NSW_SECRET || '')),
      'apikey': env.FUELCHECK_NSW_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  const rawItems = data.prices || data.stations || [];

  const stations = rawItems.map((s) => {
    const sLat = s.location?.latitude ?? s.latitude ?? s.lat;
    const sLng = s.location?.longitude ?? s.longitude ?? s.lng;
    const id = s.stationCode || s.serviceStationId || s.id;
    const brand = s.brand || s.stationName || '';
    const address = s.address || '';
    const suburb = s.suburb || s.location?.suburb || '';
    const updatedAt = s.lastupdated || s.priceUpdatedDate || null;

    const prices = {};
    if (s.prices && Array.isArray(s.prices)) {
      for (const p of s.prices) {
        if (p.fuelType && p.price != null) {
          prices[p.fuelType] = p.price;
        }
      }
    } else if (s.fuelType && s.price != null) {
      prices[s.fuelType] = s.price;
    }

    return {
      id: `AU-${id}`,
      brand,
      address,
      city: suburb,
      lat: parseFloat(sLat),
      lng: parseFloat(sLng),
      prices,
      updatedAt,
    };
  }).filter((s) => !isNaN(s.lat) && !isNaN(s.lng));

  await putGridCache(cacheKey, stations, env, 300);

  const filtered = filterByDistance(stations, lat, lng, radiusKm);
  return json({ stations: filtered, count: filtered.length });
}

export async function handleQuery(url, env, countryCode) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const state = detectState(lat, lng);

  switch (state) {
    case 'WA':
      return australiaWA.handleQuery(url, env, countryCode);
    case 'QLD':
      return australiaQLD.handleQuery(url, env, countryCode);
    default:
      return handleNSW(url, env);
  }
}
