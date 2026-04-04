/**
 * Australia — multi-state router.
 *
 * WA: FuelWatch RSS (Tier A, bulk-cached)
 * QLD: QLD Open Data CKAN (Tier B, grid-cached)
 * NSW + TAS: FuelPriceCheck v2 API (OAuth + nearby search)
 * Other states: OSM Overpass fallback
 */

import { filterByDistance, gridCell } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getGridCache, putGridCache } from '../lib/kv.js';
import { queryOverpass } from '../lib/overpass.js';
import * as australiaWA from './australia-wa.js';
import * as australiaQLD from './australia-qld.js';

function detectState(lat, lng) {
  if (lng < 129) return 'WA';
  if (lat > -29 && lng > 138) return 'QLD';
  if (lat > -37.5 && lat <= -28 && lng > 141) return 'NSW';
  if (lat < -40 && lng > 144) return 'TAS';
  return 'OTHER';
}

// ─── NSW/TAS: FuelPriceCheck v2 with OAuth ───────────────────────────

const TOKEN_URL = 'https://api.onegov.nsw.gov.au/oauth/client_credential/accesstoken?grant_type=client_credentials';
const NEARBY_URL = 'https://api.onegov.nsw.gov.au/FuelPriceCheck/v2/fuel/prices/nearby';

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken(env) {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch(TOKEN_URL, {
    headers: {
      'Authorization': 'Basic ' + btoa(env.FUELCHECK_NSW_KEY + ':' + (env.FUELCHECK_NSW_SECRET || '')),
    },
  });
  if (!res.ok) throw new Error(`OAuth token error: ${res.status}`);
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (parseInt(data.expires_in, 10) - 60) * 1000; // refresh 1 min early
  return cachedToken;
}

function formatTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const h = d.getUTCHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(h12)}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} ${ampm}`;
}

async function handleNSW(url, env) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const radiusKm = parseFloat(url.searchParams.get('radius') || '15');
  const fuelType = url.searchParams.get('fuelType') || 'E10';

  if (!env.FUELCHECK_NSW_KEY) {
    return json({ error: 'FuelCheck NSW API key not configured' }, 503);
  }

  const grid = gridCell(lat, lng);
  const cacheKey = `cache:AU-NSW:${grid.lat}:${grid.lng}:${fuelType}`;

  const cached = await getGridCache(cacheKey, env);
  if (cached) {
    const filtered = filterByDistance(cached, lat, lng, radiusKm);
    return json({ stations: filtered, count: filtered.length });
  }

  const token = await getAccessToken(env);

  const res = await fetch(NEARBY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'apikey': env.FUELCHECK_NSW_KEY,
      'transactionid': crypto.randomUUID(),
      'requesttimestamp': formatTimestamp(),
    },
    body: JSON.stringify({
      fueltype: fuelType,
      latitude: String(grid.lat),
      longitude: String(grid.lng),
      radius: '30',
      sortby: 'price',
      sortascending: 'true',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FuelPriceCheck v2: ${res.status} ${text}`);
  }

  const data = await res.json();
  const stationList = data.stations || [];
  const priceList = data.prices || [];

  // Index prices by stationcode
  const priceMap = new Map();
  for (const p of priceList) {
    if (!priceMap.has(p.stationcode)) priceMap.set(p.stationcode, {});
    if (p.price != null) {
      priceMap.get(p.stationcode)[p.fueltype] = p.price;
    }
  }

  const stations = stationList.map((s) => {
    const sLat = s.location?.latitude;
    const sLng = s.location?.longitude;
    if (sLat == null || sLng == null) return null;

    return {
      id: `AU-${s.code}`,
      brand: s.brand || s.name || 'Station',
      name: s.name || '',
      address: s.address || '',
      city: '',
      lat: sLat,
      lng: sLng,
      country: 'AU',
      prices: priceMap.get(s.code) || {},
      updatedAt: (priceList.find((p) => p.stationcode === s.code) || {}).lastupdated || null,
      distance: s.location?.distance || null,
    };
  }).filter(Boolean);

  await putGridCache(cacheKey, stations, env, 300);

  const filtered = filterByDistance(stations, lat, lng, radiusKm);
  return json({ stations: filtered, count: filtered.length });
}

// ─── OSM fallback for other states ───────────────────────────────────

const BRAND_MAP = {
  caltex: 'Caltex', bp: 'BP', shell: 'Shell', ampol: 'Ampol',
  '7-eleven': '7-Eleven', united: 'United', mobil: 'Mobil',
  'coles express': 'Coles Express', woolworths: 'Woolworths',
  metro: 'Metro', liberty: 'Liberty', puma: 'Puma Energy',
};

async function handleOSMFallback(url, env) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const radiusKm = parseFloat(url.searchParams.get('radius') || '15');

  const grid = gridCell(lat, lng);
  const cacheKey = `cache:AU-OSM:${grid.lat}:${grid.lng}`;

  let stations = await getGridCache(cacheKey, env);
  if (!stations) {
    const elements = await queryOverpass(grid.lat, grid.lng, Math.min(radiusKm * 1000, 25000));
    stations = elements.map((el) => {
      const elLat = el.lat || el.center?.lat;
      const elLng = el.lon || el.center?.lon;
      if (!elLat || !elLng) return null;
      const tags = el.tags || {};
      const brand = (tags.brand || tags.name || 'Station').trim();
      return {
        id: `AU-${el.id}`, brand: BRAND_MAP[brand.toLowerCase()] || brand,
        name: tags.name || brand,
        address: [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' '),
        city: tags['addr:suburb'] || tags['addr:city'] || '',
        lat: elLat, lng: elLng, country: 'AU', prices: {}, updatedAt: null,
      };
    }).filter(Boolean);
    await putGridCache(cacheKey, stations, env, 600);
  }

  const filtered = filterByDistance(stations, lat, lng, radiusKm);
  return json({ stations: filtered, count: filtered.length });
}

// ─── Router ──────────────────────────────────────────────────────────

export async function handleQuery(url, env, countryCode) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const state = detectState(lat, lng);

  switch (state) {
    case 'WA':
      return australiaWA.handleQuery(url, env, countryCode);
    case 'QLD':
      return australiaQLD.handleQuery(url, env, countryCode);
    case 'NSW':
    case 'TAS':
      return handleNSW(url, env);
    default:
      return handleOSMFallback(url, env);
  }
}
