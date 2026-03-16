/**
 * Cloudflare Worker — Brazil ANP fuel price proxy.
 *
 * - Cron trigger (weekly): downloads ANP CSV, geocodes via IBGE, stores in D1
 * - HTTP GET /api/brazil?lat=X&lng=Y&radius=Z: returns nearby stations as JSON
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ANP publishes rolling 4-week CSVs split by fuel type.
const ANP_CSV_URLS = [
  'https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/shpc/qus/ultimas-4-semanas-gasolina-etanol.csv',
  'https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/shpc/qus/ultimas-4-semanas-diesel-gnv.csv',
];

// IBGE API — returns municipality coordinates (all ~5,500 Brazilian municipalities)
const IBGE_MUNICIPIOS_URL =
  'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (url.pathname === '/api/brazil') {
      return handleQuery(url, env);
    }

    if (url.pathname === '/api/brazil/refresh') {
      return handleRefresh(env);
    }

    if (url.pathname === '/api/brazil/status') {
      const count = await env.DB.prepare('SELECT COUNT(*) as cnt FROM stations').first();
      return json({ stations: count?.cnt || 0 });
    }

    return new Response('Not found', { status: 404 });
  },

  async scheduled(event, env) {
    console.log('Cron triggered: refreshing ANP data...');
    await refreshData(env);
  },
};

// ─── Query nearby stations ────────────────────────────────────────────
async function handleQuery(url, env) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const radiusKm = parseFloat(url.searchParams.get('radius') || '10');

  if (isNaN(lat) || isNaN(lng)) {
    return json({ error: 'lat and lng are required' }, 400);
  }

  // Bounding box filter (rough, then refine with haversine)
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

  const result = await env.DB.prepare(
    `SELECT * FROM stations
     WHERE lat BETWEEN ?1 AND ?2
       AND lng BETWEEN ?3 AND ?4
     LIMIT 500`
  )
    .bind(lat - dLat, lat + dLat, lng - dLng, lng + dLng)
    .all();

  const stations = (result.results || [])
    .map((s) => {
      const dist = haversine(lat, lng, s.lat, s.lng);
      if (dist > radiusKm) return null;

      const prices = {};
      if (s.gasolina != null) prices.gasolina = s.gasolina;
      if (s.gasolina_ad != null) prices.gasolina_ad = s.gasolina_ad;
      if (s.etanol != null) prices.etanol = s.etanol;
      if (s.diesel != null) prices.diesel = s.diesel;
      if (s.gnv != null) prices.gnv = s.gnv;

      return {
        id: `BR-${s.id}`,
        brand: s.brand,
        address: s.address,
        city: s.city,
        lat: s.lat,
        lng: s.lng,
        prices,
        updatedAt: s.updated_at,
        distance: Math.round(dist * 100) / 100,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 100);

  return json({ stations, count: stations.length });
}

// ─── Manual refresh trigger ───────────────────────────────────────────
async function handleRefresh(env) {
  try {
    const count = await refreshData(env);
    return json({ ok: true, stations_imported: count });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// ─── Download & parse ANP CSVs ────────────────────────────────────────
async function refreshData(env) {
  // Step 1: Build municipality → coords lookup from IBGE
  console.log('Fetching IBGE municipality coordinates...');
  const geoLookup = await buildGeoLookup();
  console.log(`IBGE lookup built: ${geoLookup.size} municipalities`);

  // Step 2: Download both ANP CSVs in parallel
  console.log('Fetching ANP CSVs...');
  const responses = await Promise.all(
    ANP_CSV_URLS.map(async (csvUrl) => {
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error(`ANP download failed (${csvUrl}): ${res.status}`);
      return res.text();
    })
  );
  console.log('ANP CSVs downloaded');

  // Step 3: Parse CSVs into station map
  const stationMap = new Map();

  for (const text of responses) {
    const lines = text.split('\n');
    if (lines.length < 2) continue;

    const header = parseCSVLine(lines[0]);
    const col = (name) => header.findIndex((h) => h.toLowerCase().includes(name.toLowerCase()));

    const iCNPJ = col('cnpj');
    const iBrand = col('bandeira') >= 0 ? col('bandeira') : col('marca');
    const iStreet = col('nome da rua') >= 0 ? col('nome da rua') : col('endereco');
    const iNumber = col('numero rua');
    const iNeighborhood = col('bairro');
    const iCity = col('municipio') >= 0 ? col('municipio') : col('munic');
    const iState = col('estado') >= 0 ? col('estado') : col('uf');
    const iProduct = col('produto');
    const iPrice = col('valor de venda') >= 0 ? col('valor de venda') : col('preco');
    const iDate = col('data da coleta') >= 0 ? col('data da coleta') : col('data');
    const iName = col('revenda');

    console.log('Columns:', header.join(' | '));

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const f = parseCSVLine(lines[i]);

      const cnpj = f[iCNPJ]?.trim();
      if (!cnpj) continue;

      const city = f[iCity]?.trim() || '';
      const state = f[iState]?.trim() || '';

      if (!stationMap.has(cnpj)) {
        // Geocode by municipality+state
        const key = normalizeGeoKey(city, state);
        const coords = geoLookup.get(key);
        if (!coords) continue; // skip stations we can't geocode

        // Add small random offset so stations in same city don't stack
        const jitterLat = (Math.random() - 0.5) * 0.01;
        const jitterLng = (Math.random() - 0.5) * 0.01;

        const street = f[iStreet]?.trim() || '';
        const number = f[iNumber]?.trim() || '';
        const neighborhood = iNeighborhood >= 0 ? f[iNeighborhood]?.trim() || '' : '';
        const address = [street, number, neighborhood].filter(Boolean).join(', ');

        stationMap.set(cnpj, {
          id: cnpj,
          brand: f[iBrand]?.trim() || 'Posto',
          name: f[iName]?.trim() || '',
          address,
          city,
          state,
          lat: coords.lat + jitterLat,
          lng: coords.lng + jitterLng,
          gasolina: null,
          gasolina_ad: null,
          etanol: null,
          diesel: null,
          gnv: null,
          updated_at: f[iDate]?.trim() || null,
        });
      }

      // Add price for this fuel product
      const station = stationMap.get(cnpj);
      const product = (f[iProduct] || '').toLowerCase();
      const price = parseFloat((f[iPrice] || '').replace(',', '.'));
      if (isNaN(price)) continue;

      if (product.includes('gasolina') && product.includes('aditiv')) {
        station.gasolina_ad = price;
      } else if (product.includes('gasolina')) {
        station.gasolina = price;
      } else if (product.includes('etanol')) {
        station.etanol = price;
      } else if (product.includes('diesel')) {
        station.diesel = price;
      } else if (product.includes('gnv') || product.includes('natural')) {
        station.gnv = price;
      }

      // Keep the most recent date
      const date = f[iDate]?.trim();
      if (date && (!station.updated_at || date > station.updated_at)) {
        station.updated_at = date;
      }
    }
  }

  console.log(`Parsed ${stationMap.size} unique stations with coordinates`);

  // Step 4: Clear and re-insert into D1
  await env.DB.prepare('DELETE FROM stations').run();

  const stations = [...stationMap.values()];
  const BATCH_SIZE = 100;

  for (let i = 0; i < stations.length; i += BATCH_SIZE) {
    const batch = stations.slice(i, i + BATCH_SIZE);
    const stmts = batch.map((s) =>
      env.DB.prepare(
        `INSERT OR REPLACE INTO stations (id, brand, address, city, state, lat, lng, gasolina, gasolina_ad, etanol, diesel, gnv, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`
      ).bind(s.id, s.brand, s.address, s.city, s.state, s.lat, s.lng, s.gasolina, s.gasolina_ad, s.etanol, s.diesel, s.gnv, s.updated_at)
    );
    await env.DB.batch(stmts);
  }

  console.log(`Imported ${stations.length} stations into D1`);
  return stations.length;
}

// ─── IBGE municipality geocoding ──────────────────────────────────────
async function buildGeoLookup() {
  const res = await fetch(IBGE_MUNICIPIOS_URL);
  if (!res.ok) throw new Error(`IBGE API failed: ${res.status}`);
  const municipalities = await res.json();

  const lookup = new Map();
  for (const m of municipalities) {
    // IBGE returns: municipio-nome, UF-sigla, mesorregiao-*, microrregiao-*
    // Coordinates come from the region data — we use the IBGE geocoding endpoint instead
    const name = m['municipio-nome'] || m.nome || '';
    const uf = m['UF-sigla'] || '';
    const id = m['municipio-id'] || m.id;

    if (name && uf && id) {
      const key = normalizeGeoKey(name, uf);
      // We'll resolve coords separately — for now store the ID
      lookup.set(key, { id, name, uf });
    }
  }

  // Use a community-maintained dataset of Brazilian municipality coordinates
  const coordsJsonRes = await fetch(
    'https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/json/municipios.json'
  );
  if (!coordsJsonRes.ok) throw new Error(`Municipality coords fetch failed: ${coordsJsonRes.status}`);
  const rawText = await coordsJsonRes.text();
  const coordsJson = JSON.parse(rawText.replace(/^\uFEFF/, ''));

  const geoLookup = new Map();
  for (const m of coordsJson) {
    // Format: { codigo_ibge, nome, latitude, longitude, capital, codigo_uf, silesUF }
    const name = m.nome || '';
    const uf = m.codigo_uf;
    const lat = parseFloat(m.latitude);
    const lng = parseFloat(m.longitude);

    if (!name || isNaN(lat) || isNaN(lng)) continue;

    // We need to map codigo_uf (number) to state abbreviation
    const ufSigla = UF_CODES[uf] || '';
    if (!ufSigla) continue;

    const key = normalizeGeoKey(name, ufSigla);
    geoLookup.set(key, { lat, lng });
  }

  return geoLookup;
}

// Brazilian state codes → abbreviations (IBGE numbering)
const UF_CODES = {
  11: 'RO', 12: 'AC', 13: 'AM', 14: 'RR', 15: 'PA', 16: 'AP', 17: 'TO',
  21: 'MA', 22: 'PI', 23: 'CE', 24: 'RN', 25: 'PB', 26: 'PE', 27: 'AL',
  28: 'SE', 29: 'BA', 31: 'MG', 32: 'ES', 33: 'RJ', 35: 'SP',
  41: 'PR', 42: 'SC', 43: 'RS', 50: 'MS', 51: 'MT', 52: 'GO', 53: 'DF',
};

// Normalize city+state key for matching (remove accents, uppercase)
function normalizeGeoKey(city, state) {
  return (city + '|' + state)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// ─── CSV parser (ANP uses ; as delimiter) ─────────────────────────────
function parseCSVLine(line) {
  return line.split(';').map((f) => f.replace(/^"|"$/g, '').trim());
}

// ─── Haversine distance (km) ──────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── JSON response helper ─────────────────────────────────────────────
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
