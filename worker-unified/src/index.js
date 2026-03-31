import { handleOptions } from './lib/cors.js';
import { json } from './lib/response.js';

// Tier A — bulk-cached countries (full dataset refresh via cron)
import * as france from './countries/france.js';
import * as spain from './countries/spain.js';
import * as italy from './countries/italy.js';
import * as uk from './countries/uk.js';
import * as switzerland from './countries/switzerland.js';
import * as chile from './countries/chile.js';
import * as mexico from './countries/mexico.js';
import * as argentina from './countries/argentina.js';
import * as denmark from './countries/denmark.js';
import * as australiaWA from './countries/australia-wa.js';
import * as malaysia from './countries/malaysia.js';

// Tier B — proxy + grid-cache (on-demand)
import * as tankerkoenig from './countries/tankerkoenig.js';
import * as austria from './countries/austria.js';
import * as southKorea from './countries/south-korea.js';
import * as australia from './countries/australia.js';
import * as newZealand from './countries/new-zealand.js';
import * as netherlands from './countries/netherlands.js';
import * as belgium from './countries/belgium.js';
import * as greece from './countries/greece.js';
import * as uae from './countries/uae.js';
import * as southAfrica from './countries/south-africa.js';
import * as slovenia from './countries/slovenia.js';
import * as croatia from './countries/croatia.js';
import * as portugal from './countries/portugal.js';
import * as luxembourg from './countries/luxembourg.js';

// Tier C — proxy
import * as brazil from './countries/brazil.js';

const TIER_A = {
  fr: france, es: spain, it: italy, uk: uk, ch: switzerland,
  cl: chile, mx: mexico, ar: argentina,
  dk: denmark, wa: australiaWA, my: malaysia,
};

const HANDLERS = {
  ...TIER_A,
  de: tankerkoenig,
  hr: croatia,
  lu: luxembourg,
  pt: portugal,
  si: slovenia,
  at: austria,
  kr: southKorea,
  au: australia,
  br: brazil,
  nz: newZealand,
  nl: netherlands,
  be: belgium,
  gr: greece,
  ae: uae,
  za: southAfrica,
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    const url = new URL(request.url);

    // Logo proxy — fetches brand logos with CORS headers, cached in KV
    if (url.pathname.startsWith('/logo/')) {
      return handleLogo(url.pathname.slice(6), env);
    }

    // Manual cron trigger endpoint
    if (url.pathname === '/cron') {
      const ctx = { waitUntil: (p) => p };
      await this.scheduled({}, env, ctx);
      return json({ ok: true, message: 'Cron refresh completed' });
    }

    // One-time Mapbox brand crawl for France
    if (url.pathname === '/api/fr/build-brands') {
      try {
        const result = await france.buildBrands(env);
        return json({ ok: true, ...result });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // Google Places supplementary brand crawl (targets only unmatched stations)
    if (url.pathname === '/api/fr/build-brands-google') {
      try {
        const result = await france.buildBrandsGoogle(env);
        return json({ ok: true, ...result });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // Foursquare supplementary brand crawl (merges into existing brand DB)
    if (url.pathname === '/api/fr/build-brands-fsq') {
      try {
        const result = await france.buildBrandsFoursquare(env);
        return json({ ok: true, ...result });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // Speed test — measures worker processing time (KV read + filter), independent of client location
    if (url.pathname === '/speed') {
      const cf = request.cf || {};
      const tests = {};
      for (const [code, handler] of Object.entries(TIER_A)) {
        const testUrl = new URL(`${url.origin}/api/${code}?lat=48.85&lng=2.35&radius=10`);
        const start = performance.now();
        try {
          const res = await handler.handleQuery(testUrl, env, code);
          const body = await res.json();
          tests[code.toUpperCase()] = {
            ms: Math.round(performance.now() - start),
            count: body.count || 0,
          };
        } catch (e) {
          tests[code.toUpperCase()] = { ms: Math.round(performance.now() - start), error: e.message };
        }
      }
      return json({
        edgeLocation: cf.colo || 'unknown',
        country: cf.country || 'unknown',
        city: cf.city || 'unknown',
        tests,
      });
    }

    const match = url.pathname.match(/^\/api\/([a-z]{2})$/);

    if (!match) {
      return json({ error: 'Not found. Use /api/{country_code}' }, 404);
    }

    const countryCode = match[1];
    const handler = HANDLERS[countryCode];

    if (!handler) {
      return json({ error: `Unsupported country: ${countryCode}` }, 400);
    }

    const lat = parseFloat(url.searchParams.get('lat'));
    const lng = parseFloat(url.searchParams.get('lng'));
    if (isNaN(lat) || isNaN(lng)) {
      return json({ error: 'lat and lng query params are required' }, 400);
    }

    try {
      return await handler.handleQuery(url, env, countryCode);
    } catch (e) {
      console.error(`[${countryCode.toUpperCase()}] Error:`, e);
      return json({ error: e.message }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    console.log('[Cron] Starting bulk refresh for all Tier A countries...');

    const results = await Promise.allSettled(
      Object.entries(TIER_A).map(async ([code, mod]) => {
        const start = Date.now();
        await mod.refresh(env);
        console.log(`[Cron] ${code.toUpperCase()} refreshed in ${Date.now() - start}ms`);
      })
    );

    for (const [i, r] of results.entries()) {
      if (r.status === 'rejected') {
        const code = Object.keys(TIER_A)[i];
        console.error(`[Cron] ${code.toUpperCase()} FAILED:`, r.reason);
      }
    }
  },
};

// ─── Logo proxy ──────────────────────────────────────────────────────
import { CORS_HEADERS } from './lib/cors.js';

async function handleLogo(domain, env) {
  if (!domain || domain.length > 100) {
    return new Response(null, { status: 400 });
  }

  const cacheKey = `logo:${domain}`;

  // Check KV cache (contains Brandfetch high-quality logos + fallback fetched logos)
  const cached = await env.FUEL_KV.get(cacheKey, { type: 'arrayBuffer' });
  if (cached) {
    return new Response(cached, {
      headers: {
        'Content-Type': detectImageType(new Uint8Array(cached)),
        'Cache-Control': 'public, max-age=604800',
        ...CORS_HEADERS,
      },
    });
  }

  // Fallback sources (KV had nothing — brand not pre-loaded via Brandfetch)
  let imgData = null;

  // 1. Uplead (consistent 128px PNG, decent quality)
  imgData = await fetchImage(`https://logo.uplead.com/${domain}`, 500);

  // 2. Google favicons as last resort only
  if (!imgData) {
    imgData = await fetchImage(
      `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${domain}&size=256`,
      100
    );
  }

  if (!imgData) {
    return new Response(null, { status: 404, headers: CORS_HEADERS });
  }

  // Cache in KV for 7 days
  await env.FUEL_KV.put(cacheKey, imgData, { expirationTtl: 604800 });

  return new Response(imgData, {
    headers: {
      'Content-Type': detectImageType(new Uint8Array(imgData)),
      'Cache-Control': 'public, max-age=604800',
      ...CORS_HEADERS,
    },
  });
}

function detectImageType(bytes) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) return 'image/jpeg';
  if (bytes[0] === 0x3C || (bytes[0] === 0xEF && bytes[1] === 0xBB)) return 'image/svg+xml';
  if (bytes[0] === 0x00 && bytes[1] === 0x00) return 'image/x-icon';
  return 'image/png';
}

async function fetchImage(url, minBytes = 500) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok || res.status === 404) return null;
    const buf = await res.arrayBuffer();
    // Skip tiny images (16x16 favicons, error pages)
    if (buf.byteLength < minBytes) return null;
    return buf;
  } catch {
    return null;
  }
}
