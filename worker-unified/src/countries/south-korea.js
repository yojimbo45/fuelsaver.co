/**
 * South Korea — OPINET (Korea National Oil Corporation) API.
 *
 * Tier B: proxy + grid-cache pattern.
 *
 * Uses lowTop10.do endpoint (cheapest stations per region) to avoid
 * KATEC coordinate conversion required by aroundAll.do.
 * Requires a free API key from OPINET (env.OPINET_KEY).
 */

import { filterByDistance, gridCell, haversine } from '../lib/geo.js';
import { json } from '../lib/response.js';
import { getGridCache, putGridCache } from '../lib/kv.js';

const API_BASE = 'https://www.opinet.co.kr/api';

// Korean administrative regions with center coordinates for nearest-area matching
const AREAS = [
  { code: '01', name: 'Seoul', lat: 37.5665, lng: 126.9780 },
  { code: '02', name: 'Gyeonggi', lat: 37.4138, lng: 127.5183 },
  { code: '03', name: 'Gangwon', lat: 37.8228, lng: 128.1555 },
  { code: '04', name: 'Chungbuk', lat: 36.6357, lng: 127.4914 },
  { code: '05', name: 'Chungnam', lat: 36.6588, lng: 126.6728 },
  { code: '06', name: 'Jeonbuk', lat: 35.8203, lng: 127.1089 },
  { code: '07', name: 'Jeonnam', lat: 34.8161, lng: 126.4629 },
  { code: '08', name: 'Gyeongbuk', lat: 36.4919, lng: 128.8889 },
  { code: '09', name: 'Gyeongnam', lat: 35.4606, lng: 128.2132 },
  { code: '10', name: 'Jeju', lat: 33.4996, lng: 126.5312 },
  { code: '11', name: 'Daejeon', lat: 36.3504, lng: 127.3845 },
  { code: '12', name: 'Daegu', lat: 35.8714, lng: 128.6014 },
  { code: '13', name: 'Incheon', lat: 37.4563, lng: 126.7052 },
  { code: '14', name: 'Gwangju', lat: 35.1595, lng: 126.8526 },
  { code: '15', name: 'Busan', lat: 35.1796, lng: 129.0756 },
  { code: '16', name: 'Ulsan', lat: 35.5384, lng: 129.3114 },
  { code: '17', name: 'Sejong', lat: 36.4800, lng: 127.0000 },
];

// Fuel product codes used by OPINET
const FUEL_CODES = ['B027', 'B034', 'D047', 'K015'];

function findNearestArea(lat, lng) {
  let best = AREAS[0];
  let bestDist = Infinity;
  for (const area of AREAS) {
    const d = haversine(lat, lng, area.lat, area.lng);
    if (d < bestDist) {
      bestDist = d;
      best = area;
    }
  }
  return best;
}

export async function handleQuery(url, env, countryCode) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const radiusKm = parseFloat(url.searchParams.get('radius') || '15');

  if (!env.OPINET_KEY) {
    return json({ error: 'OPINET API key not configured' }, 503);
  }

  const grid = gridCell(lat, lng);
  const cacheKey = `cache:KR:${grid.lat}:${grid.lng}`;

  let stations = await getGridCache(cacheKey, env);
  if (!stations) {
    const area = findNearestArea(grid.lat, grid.lng);

    // Fetch cheapest stations for each fuel type in the nearest region
    const stationMap = {};
    const results = await Promise.allSettled(
      FUEL_CODES.map(async (prodcd) => {
        const apiUrl = `${API_BASE}/lowTop10.do?code=${env.OPINET_KEY}&out=json&prodcd=${prodcd}&area=${area.code}&cnt=30`;
        const res = await fetch(apiUrl);
        if (!res.ok) return [];
        const data = await res.json();
        return { prodcd, list: data?.RESULT?.OIL || [] };
      })
    );

    for (const result of results) {
      if (result.status !== 'fulfilled' || !result.value) continue;
      const { prodcd, list } = result.value;

      for (const s of list) {
        const id = s.UNI_ID;
        if (!stationMap[id]) {
          stationMap[id] = {
            id: `KR-${id}`,
            brand: s.POLL_DIV_CO || '',
            name: s.OS_NM || '',
            address: s.NEW_ADR || s.VAN_ADR || '',
            city: '',
            lat: parseFloat(s.GIS_Y_COOR),
            lng: parseFloat(s.GIS_X_COOR),
            country: 'KR',
            prices: {},
            updatedAt: null,
          };
        }
        if (s.PRICE != null) {
          stationMap[id].prices[prodcd] = { price: s.PRICE };
        }
      }
    }

    stations = Object.values(stationMap).filter((s) => !isNaN(s.lat) && !isNaN(s.lng));
    await putGridCache(cacheKey, stations, env, 300);
  }

  const filtered = filterByDistance(stations, lat, lng, radiusKm);
  return json({ stations: filtered, count: filtered.length });
}
