/**
 * Shared helper for gas.didnt.work API (Waze-sourced fuel prices).
 * Used by Estonia, Latvia, Lithuania, and Poland country modules.
 *
 * API: GET https://gas.didnt.work/api/stations?bbox={west},{south},{east},{north}
 * Returns JSON array of stations with nested price objects.
 */

const API_BASE = 'https://gas.didnt.work/api/stations';
const BBOX_PAD = 0.15; // ~17km padding around grid center

/**
 * Fetch stations from gas.didnt.work for a grid cell.
 *
 * @param {number} lat  Grid cell center latitude
 * @param {number} lng  Grid cell center longitude
 * @param {string} countryCode  2-letter country code (for station ID prefix)
 * @param {Object} fuelKeyMap   API fuel key → internal fuel key (e.g. { '95': 'e95' })
 * @param {Object} brandMap     Lowercase brand → normalized name (e.g. { 'circle k': 'Circle K' })
 * @returns {Array} Normalized station objects
 */
export async function fetchGasDidntWork(lat, lng, countryCode, fuelKeyMap, brandMap) {
  const west = (lng - BBOX_PAD).toFixed(4);
  const south = (lat - BBOX_PAD).toFixed(4);
  const east = (lng + BBOX_PAD).toFixed(4);
  const north = (lat + BBOX_PAD).toFixed(4);

  const url = `${API_BASE}?bbox=${west},${south},${east},${north}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FuelSaver/1.0)' },
  });
  if (!res.ok) return [];

  const raw = await res.json();
  if (!Array.isArray(raw)) return [];

  return raw.map((s) => {
    if (!s.coords || s.coords.length < 2) return null;

    // Map prices through fuelKeyMap (case-insensitive), extract .price from nested objects
    const prices = {};
    if (s.prices) {
      for (const [apiKey, val] of Object.entries(s.prices)) {
        const mappedKey = fuelKeyMap[apiKey] || fuelKeyMap[apiKey.toLowerCase()];
        if (!mappedKey) continue;
        const price = typeof val === 'object' && val !== null ? val.price : val;
        if (price != null && price > 0) {
          prices[mappedKey] = price;
        }
      }
    }

    // Skip stations with no mapped prices
    if (Object.keys(prices).length === 0) return null;

    // Normalize brand
    const rawBrand = (s.brand || s.name || '').trim();
    const brandLower = rawBrand.toLowerCase();
    const brand = brandMap[brandLower] || rawBrand;

    // Extract city from address (last segment before country)
    const parts = (s.address || '').split(',').map((p) => p.trim());
    const city = parts.length >= 3 ? parts[parts.length - 2] : parts[0] || '';
    const address = parts.slice(0, -1).join(', ') || s.address || '';

    return {
      id: `${countryCode}-gdw-${s.id}`,
      brand,
      address,
      city,
      lat: s.coords[0],
      lng: s.coords[1],
      country: countryCode,
      prices,
      updatedAt: s.ts ? new Date(s.ts * 1000).toISOString() : null,
    };
  }).filter(Boolean);
}
