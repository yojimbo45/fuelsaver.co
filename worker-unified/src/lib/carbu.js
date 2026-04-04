/**
 * Shared scraper for carbu.com — used by Belgium and Luxembourg.
 *
 * Flow:
 *   1. Reverse-geocode (lat, lng) -> postal code + town via Nominatim
 *   2. Resolve postal code -> carbu.com location ID
 *   3. For each fuel type, fetch the station-list HTML page
 *   4. Parse data-* attributes from the HTML
 *   5. Merge stations across fuel types by data-id
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const NOMINATIM_URL =
  'https://nominatim.openstreetmap.org/reverse';

const CARBU_LOCATION_URL =
  'https://carbu.com/commonFunctions/getlocation/controller.getlocation_JSON.php';

// ─── Brand normalization ────────────────────────────────────────────
const BRAND_NORMALIZE = {
  totalenergies: 'TotalEnergies',
  total: 'TotalEnergies',
  shell: 'Shell',
  esso: 'Esso',
  texaco: 'Texaco',
  q8: 'Q8',
  lukoil: 'Lukoil',
  gulf: 'Gulf',
  octa: 'Octa+',
  'octa+': 'Octa+',
  gabriels: 'Gabriels',
  dats24: 'DATS 24',
  'dats 24': 'DATS 24',
  aral: 'Aral',
  avia: 'AVIA',
  maes: 'Maes',
  power: 'Power',
  argos: 'Argos',
  tango: 'Tango',
  'red market': 'Red Market',
  colruyt: 'Colruyt',
  makro: 'Makro',
};

function extractBrand(name) {
  if (!name) return 'Station';
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();

  // Exact match
  if (BRAND_NORMALIZE[lower]) return BRAND_NORMALIZE[lower];

  // Try first word as brand prefix
  const firstWord = lower.split(/[\s\-]+/)[0];
  if (BRAND_NORMALIZE[firstWord]) return BRAND_NORMALIZE[firstWord];

  // Return the raw name, title-cased, as fallback
  if (trimmed.length > 0) {
    return trimmed.replace(/\b\w+/g, (w) =>
      w.length <= 2
        ? w.toUpperCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    );
  }
  return 'Station';
}

// ─── Step 1: Reverse geocode ────────────────────────────────────────
async function reverseGeocode(lat, lng) {
  const url = `${NOMINATIM_URL}?lat=${lat}&lon=${lng}&format=json&zoom=16`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'FuelSaverApp/1.0' },
  });
  if (!res.ok) {
    throw new Error(`Nominatim reverse geocode failed: ${res.status}`);
  }
  const data = await res.json();
  const address = data.address || {};
  const postalCode = address.postcode || '';
  // Prefer town/city/village for the town name
  const townName =
    address.town ||
    address.city ||
    address.village ||
    address.municipality ||
    address.suburb ||
    '';
  return { postalCode, townName };
}

// ─── Step 2: Get carbu.com location ID ──────────────────────────────
async function getCarbuLocation(postalCode, countryCode) {
  const url = `${CARBU_LOCATION_URL}?location=${encodeURIComponent(postalCode)}&SHRT=1`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) {
    throw new Error(`Carbu location lookup failed: ${res.status}`);
  }
  const data = await res.json();
  const items = Array.isArray(data) ? data : data ? [data] : [];

  // Filter by country code (BE, LU) to avoid matching wrong countries
  const cc = countryCode.toUpperCase();
  const item = items.find((i) => (i.c || '').toUpperCase() === cc) || items[0];

  if (!item) {
    throw new Error(`No carbu location found for postal code: ${postalCode}`);
  }

  const locationId = item.id || item.ac || '';
  const townName = item.n || '';

  if (!locationId) {
    throw new Error(`No location ID in carbu response for: ${postalCode}`);
  }

  return { locationId: String(locationId), townName };
}

// ─── Step 3: Fetch station page HTML ────────────────────────────────
async function fetchStationPage(countryPath, fuelType, townName, postalCode, locationId) {
  // URL pattern: https://carbu.com/{countryPath}//liste-stations-service/{fuelType}/{townName}/{postalCode}/{locationId}
  const encodedTown = encodeURIComponent(townName.replace(/\s+/g, '-'));
  const url = `https://carbu.com/${countryPath}//liste-stations-service/${encodeURIComponent(fuelType)}/${encodedTown}/${encodeURIComponent(postalCode)}/${locationId}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!res.ok) {
    console.warn(`[carbu] Page fetch failed for ${fuelType}: ${res.status} — ${url}`);
    return null;
  }

  return res.text();
}

// ─── Step 4: Parse station data from HTML ───────────────────────────
function parseStationsFromHtml(html, fuelTypeKey) {
  if (!html) return [];

  const stations = [];

  // Match elements that have data-lat, data-lng, data-price, data-name, data-id
  // These attributes may appear in any order on the same HTML element.
  // We scan for chunks that contain data-id and extract all attributes from each.

  // Strategy: find all occurrences of data-id="..." and then look at the
  // surrounding context (up to ~2000 chars before) for the other attributes.
  const idPattern = /data-id="([^"]*)"/g;
  let match;

  while ((match = idPattern.exec(html)) !== null) {
    const stationId = match[1];
    if (!stationId) continue;

    // Look at a window around the match for other data attributes
    const windowStart = Math.max(0, match.index - 2000);
    const windowEnd = Math.min(html.length, match.index + 2000);
    const window = html.substring(windowStart, windowEnd);

    const latMatch = window.match(/data-lat="([^"]*)"/);
    const lngMatch = window.match(/data-lng="([^"]*)"/);
    const priceMatch = window.match(/data-price="([^"]*)"/);
    const nameMatch = window.match(/data-name="([^"]*)"/);

    const lat = latMatch ? parseFloat(latMatch[1]) : NaN;
    const lng = lngMatch ? parseFloat(lngMatch[1]) : NaN;
    const price = priceMatch ? parseFloat(priceMatch[1]) : NaN;
    const name = nameMatch ? (nameMatch[1] || '').trim() : '';

    if (isNaN(lat) || isNaN(lng)) continue;

    const entry = {
      _carbuId: stationId,
      name,
      lat,
      lng,
    };

    if (!isNaN(price) && price > 0) {
      entry.price = price;
      entry.fuelTypeKey = fuelTypeKey;
    }

    stations.push(entry);
  }

  // Deduplicate within the same page by carbu ID (keep first occurrence)
  const seen = new Set();
  return stations.filter((s) => {
    if (seen.has(s._carbuId)) return false;
    seen.add(s._carbuId);
    return true;
  });
}

// ─── Main export ────────────────────────────────────────────────────
/**
 * Scrape carbu.com for fuel stations with real prices.
 *
 * @param {string} countryPath  - 'belgie' or 'luxembourg'
 * @param {number} lat          - latitude
 * @param {number} lng          - longitude
 * @param {Object} fuelTypeMap  - e.g. { GO: 'diesel', E10: 'E10', SP98: 'SP98' }
 * @returns {Promise<Array>}    - normalized station objects
 */
export async function scrapeCarbuStations(countryPath, lat, lng, fuelTypeMap) {
  // Country code: 'belgie' -> 'BE', 'luxembourg' -> 'LU'
  const countryCode = countryPath === 'luxembourg' ? 'LU' : 'BE';

  // Step 1: Reverse geocode to postal code
  let postalCode;
  try {
    const geo = await reverseGeocode(lat, lng);
    postalCode = geo.postalCode;
  } catch (err) {
    console.error(`[carbu] Reverse geocode failed for (${lat}, ${lng}):`, err.message);
    return [];
  }

  if (!postalCode) {
    console.warn(`[carbu] No postal code found for (${lat}, ${lng})`);
    return [];
  }

  // Step 2: Get carbu.com location ID + canonical town name
  let locationId, townName;
  try {
    const loc = await getCarbuLocation(postalCode, countryCode);
    locationId = loc.locationId;
    townName = loc.townName;
  } catch (err) {
    console.error(`[carbu] Location ID lookup failed for ${postalCode}:`, err.message);
    return [];
  }

  // Step 3 & 4: Fetch and parse each fuel type in parallel
  const fuelEntries = Object.entries(fuelTypeMap);
  const scrapeResults = await Promise.allSettled(
    fuelEntries.map(async ([carbuCode, internalKey]) => {
      const html = await fetchStationPage(
        countryPath,
        carbuCode,
        townName,
        postalCode,
        locationId
      );
      return parseStationsFromHtml(html, internalKey);
    })
  );

  // Step 5: Merge stations by carbu ID across all fuel types
  const stationMap = new Map();

  for (const result of scrapeResults) {
    if (result.status !== 'fulfilled') continue;
    const parsed = result.value;

    for (const entry of parsed) {
      const id = entry._carbuId;
      if (!stationMap.has(id)) {
        stationMap.set(id, {
          _carbuId: id,
          name: entry.name,
          lat: entry.lat,
          lng: entry.lng,
          prices: {},
        });
      }

      const station = stationMap.get(id);

      // Update name if we got a better one
      if (!station.name && entry.name) {
        station.name = entry.name;
      }

      // Add this fuel type price
      if (entry.fuelTypeKey && entry.price > 0) {
        station.prices[entry.fuelTypeKey] = { price: entry.price };
      }
    }
  }

  // Step 6: Convert to normalized station array
  const stations = [];
  for (const [, raw] of stationMap) {
    const brand = extractBrand(raw.name);
    stations.push({
      id: raw._carbuId,
      brand,
      name: raw.name || brand,
      address: '',
      city: townName || '',
      lat: raw.lat,
      lng: raw.lng,
      country: '', // Caller sets this
      prices: raw.prices,
      updatedAt: null,
    });
  }

  console.log(
    `[carbu/${countryPath}] Scraped ${stations.length} stations near ${postalCode} ${townName}`
  );

  return stations;
}
