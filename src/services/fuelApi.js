/**
 * Fuel price API service.
 *
 * All countries route through the unified Cloudflare Worker at VITE_WORKER_URL.
 * Falls back to demo data when worker URL not configured.
 */

import { haversineDistance } from '../utils/geo';

const WORKER_URL = import.meta.env.VITE_WORKER_URL;

// ─── Fetch from unified worker ───────────────────────────────────────
async function fetchFromWorker(countryCode, lat, lng, radiusKm, fuelType) {
  if (!WORKER_URL) {
    console.warn('VITE_WORKER_URL not set. Using demo data.');
    return generateDemoStations(lat, lng, radiusKm, countryCode);
  }

  const url = new URL(`${WORKER_URL}/api/${countryCode.toLowerCase()}`);
  url.searchParams.set('lat', lat);
  url.searchParams.set('lng', lng);
  url.searchParams.set('radius', radiusKm);
  if (fuelType) url.searchParams.set('fuelType', fuelType);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();

  // Normalize prices: some handlers return {price: number}, others return raw numbers
  return (json.stations || []).map((s) => {
    if (!s.prices) return s;
    const normalized = {};
    for (const [key, val] of Object.entries(s.prices)) {
      normalized[key] = typeof val === 'object' && val !== null ? val.price : val;
    }
    return { ...s, prices: normalized };
  });
}

// ─── Public API ────────────────────────────────────────────────────────
const SUPPORTED_COUNTRIES = [
  'FR', 'ES', 'IT', 'UK', 'CH', 'CL', 'MX', 'AR', 'BR',
  'DE', 'HR', 'LU', 'PT', 'SI', 'AT', 'KR', 'AU',
  'DK', 'NZ', 'NL', 'BE', 'GR', 'MY', 'AE', 'ZA',
];

const fetchers = Object.fromEntries(
  SUPPORTED_COUNTRIES.map((cc) => [cc, (lat, lng, r, ft) => fetchFromWorker(cc, lat, lng, r, ft)])
);

export async function fetchStations(countryCode, lat, lng, radiusKm, fuelType) {
  const fetcher = fetchers[countryCode];
  if (!fetcher) throw new Error(`Unsupported country: ${countryCode}`);
  const stations = await fetcher(lat, lng, radiusKm, fuelType);
  console.log(`[FuelAPI] ${countryCode} stations (${stations.length}):`, stations);
  return stations;
}

// ─── Demo data fallback ──────────────────────────────────────────────

const BRANDS = {
  FR: ['TotalEnergies', 'Leclerc', 'Carrefour', 'Intermarché', 'Auchan', 'BP', 'Shell', 'Esso'],
  DE: ['Aral', 'Shell', 'Esso', 'Total', 'JET', 'AVIA', 'Agip', 'Star'],
  HR: ['INA', 'Petrol', 'MOL', 'OMV', 'Tifon', 'Crodux', 'Lukoil'],
  LU: ['Aral', 'Shell', 'TotalEnergies', 'Q8', 'Esso', 'Lukoil', 'Gulf'],
  PT: ['Galp', 'Repsol', 'BP', 'Cepsa', 'Prio', 'Intermarche', 'Jumbo'],
  SI: ['Petrol', 'MOL', 'OMV', 'Hofer (AVIA)', 'Euroil'],
  UK: ['BP', 'Shell', 'Esso', 'Tesco', 'Sainsbury\'s', 'Asda', 'Morrisons', 'Texaco'],
  ES: ['Repsol', 'Cepsa', 'BP', 'Shell', 'Galp', 'Petronor', 'Ballenoil'],
  IT: ['Eni', 'IP', 'Q8', 'TotalErg', 'Tamoil', 'Esso', 'API', 'Shell'],
  AT: ['OMV', 'BP', 'Shell', 'Eni', 'JET', 'Avanti', 'Turmöl', 'IQ'],
  KR: ['SK Energy', 'GS Caltex', 'S-Oil', 'Hyundai Oilbank', 'NH', 'E1'],
  CL: ['COPEC', 'Shell', 'Petrobras', 'Terpel', 'ENEX'],
  AU: ['Caltex', 'BP', 'Shell', '7-Eleven', 'United', 'Coles Express', 'Woolworths'],
  MX: ['Pemex', 'BP', 'Shell', 'Mobil', 'Total', 'Oxxo Gas', 'G500'],
  BR: ['Petrobras', 'Ipiranga', 'Shell', 'Ale', 'Repsol'],
  AR: ['YPF', 'Shell', 'Axion Energy', 'Puma', 'Gulf', 'Petrobras'],
  CH: ['Migrol', 'AVIA', 'Coop Pronto', 'Shell', 'BP', 'Eni', 'Agrola', 'Ruedi Rüssel'],
  DK: ['Q8', 'F24', 'Shell', 'Circle K', 'OK', 'Uno-X', 'Ingo'],
  NZ: ['Z Energy', 'BP', 'Mobil', 'Caltex', 'Gull', 'Challenge', 'Waitomo', 'NPD'],
  NL: ['Shell', 'BP', 'Esso', 'TotalEnergies', 'Tango', 'Tinq', 'Argos', 'Gulf'],
  BE: ['TotalEnergies', 'Shell', 'Esso', 'Texaco', 'Q8', 'Lukoil', 'Gulf', 'Gabriels'],
  GR: ['EKO', 'BP', 'Shell', 'Aegean', 'Avin', 'Revoil', 'Cyclon', 'Jet Oil'],
  MY: ['Petronas', 'Shell', 'Petron', 'BHPetrol', 'Caltex'],
  AE: ['ADNOC', 'ENOC', 'EPPCO', 'Emarat', 'Shell'],
  ZA: ['Engen', 'Shell', 'BP', 'Caltex', 'TotalEnergies', 'Sasol'],
};

const FUEL_RANGES = {
  FR: { SP95: [1.65, 1.95], SP98: [1.75, 2.05], E10: [1.60, 1.90], Gazole: [1.55, 1.85], E85: [0.75, 0.95], GPLc: [0.85, 1.05] },
  DE: { e5: [1.65, 1.95], e10: [1.60, 1.90], diesel: [1.55, 1.85] },
  HR: { e5: [1.40, 1.65], e10: [1.35, 1.60], diesel: [1.35, 1.60] },
  LU: { e5: [1.45, 1.70], e10: [1.40, 1.65], diesel: [1.40, 1.65] },
  PT: { e5: [1.60, 1.90], e10: [1.55, 1.85], diesel: [1.50, 1.80] },
  SI: { e5: [1.45, 1.70], e10: [1.40, 1.65], diesel: [1.40, 1.65] },
  UK: { unleaded: [135, 155], diesel: [140, 160], super_unleaded: [150, 170] },
  ES: { gasolina95: [1.45, 1.75], gasolina98: [1.55, 1.85], gasoleo: [1.40, 1.70], glp: [0.75, 0.95] },
  IT: { benzina: [1.70, 2.00], gasolio: [1.60, 1.90], gpl: [0.70, 0.90], metano: [1.30, 1.60] },
  AT: { SUP: [1.55, 1.85], GOE: [1.50, 1.80], GAS: [1.20, 1.50] },
  KR: { B027: [1600, 1900], B034: [1800, 2100], D047: [1500, 1800], K015: [900, 1100] },
  CL: { gasolina93: [1100, 1400], gasolina95: [1200, 1500], gasolina97: [1300, 1600], diesel: [1000, 1300], glp: [600, 800] },
  AU: { E10: [170, 210], U91: [175, 215], P95: [185, 225], P98: [195, 235], DL: [180, 220], LPG: [80, 110] },
  MX: { regular: [21, 25], premium: [23, 27], diesel: [22, 26] },
  BR: { gasolina: [5.5, 7.0], gasolina_ad: [5.8, 7.3], etanol: [3.5, 5.0], diesel: [5.0, 6.5], gnv: [3.5, 5.0] },
  AR: { nafta_super: [500, 800], nafta_premium: [600, 900], diesel: [500, 750], diesel_premium: [600, 850], gnc: [200, 400] },
  CH: { E95: [1.70, 1.95], E98: [1.80, 2.05], Diesel: [1.75, 2.00] },
  DK: { e10: [15.0, 17.5], e5: [16.5, 18.5], diesel: [16.5, 19.5], diesel_extra: [17.5, 20.0] },
  NZ: { 91: [2.80, 3.50], 95: [3.00, 3.70], 98: [3.20, 3.90], diesel: [2.70, 3.40] },
  NL: { euro95: [1.85, 2.15], diesel: [1.75, 2.05], lpg: [0.80, 1.10] },
  BE: { E10: [1.60, 1.90], SP98: [1.70, 2.00], diesel: [1.65, 1.95], LPG: [0.75, 1.00] },
  GR: { unleaded_95: [1.70, 2.00], unleaded_100: [1.85, 2.15], diesel: [1.55, 1.85], lpg: [0.80, 1.05] },
  MY: { RON95: [2.05, 2.05], RON97: [3.30, 3.60], diesel: [2.15, 2.15] },
  AE: { super98: [2.90, 3.10], special95: [2.80, 3.00], eplus91: [2.70, 2.90], diesel: [2.90, 3.10] },
  ZA: { ULP95: [21.0, 23.0], ULP93: [20.5, 22.5], diesel_50: [18.5, 20.0], diesel_500: [18.0, 19.5] },
};

function generateDemoStations(lat, lng, radiusKm, country) {
  const count = 15 + Math.floor(Math.random() * 10);
  const brands = BRANDS[country] || BRANDS.FR;
  const fuelRanges = FUEL_RANGES[country] || FUEL_RANGES.FR;

  return Array.from({ length: count }, (_, i) => {
    const angle = Math.random() * 2 * Math.PI;
    const dist = Math.random() * radiusKm;
    const dLat = (dist / 111) * Math.cos(angle);
    const dLng = (dist / (111 * Math.cos((lat * Math.PI) / 180))) * Math.sin(angle);
    const sLat = lat + dLat;
    const sLng = lng + dLng;

    const prices = {};
    for (const [fuel, [min, max]] of Object.entries(fuelRanges)) {
      if (Math.random() > 0.15) {
        prices[fuel] = +(min + Math.random() * (max - min)).toFixed(3);
      }
    }

    const hoursAgo = Math.floor(Math.random() * 48);
    const updated = new Date(Date.now() - hoursAgo * 3600000);

    return {
      id: `${country}-DEMO-${i}`,
      brand: brands[Math.floor(Math.random() * brands.length)],
      address: `${Math.floor(Math.random() * 200) + 1} Rue Example`,
      city: 'Demo City',
      lat: sLat,
      lng: sLng,
      prices,
      updatedAt: updated.toISOString(),
      distance: haversineDistance(lat, lng, sLat, sLng),
    };
  }).sort((a, b) => a.distance - b.distance);
}
