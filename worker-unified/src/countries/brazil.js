/**
 * Brazil — proxy to existing D1-backed worker.
 *
 * Forwards requests to the Brazil-specific Cloudflare Worker
 * and re-wraps the response with CORS headers.
 *
 * Tier C: simple proxy.
 */

import { json } from '../lib/response.js';

export async function handleQuery(url, env, countryCode) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const radius = parseFloat(url.searchParams.get('radius') || '15');

  if (!env.BRAZIL_WORKER_URL) {
    return json({ error: 'Brazil worker URL not configured' }, 503);
  }

  try {
    const upstream = `${env.BRAZIL_WORKER_URL}/api/brazil?lat=${lat}&lng=${lng}&radius=${radius}`;
    const res = await fetch(upstream);
    const data = await res.json();
    return json(data, res.status);
  } catch (e) {
    return json({ error: `Brazil upstream failed: ${e.message}` }, 503);
  }
}
