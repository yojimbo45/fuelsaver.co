/**
 * Two-layer cache: in-memory L1 (5 min) + KV L2.
 * Tier A countries store all stations in KV, read into memory on request.
 */

const memCache = new Map();
const MEM_TTL = 5 * 60; // 5 minutes

export async function getStations(country, env) {
  const now = Date.now() / 1000;
  const key = `stations:${country}`;

  // L1: in-memory
  const cached = memCache.get(key);
  if (cached && now - cached.timestamp < MEM_TTL) {
    return cached.data;
  }

  // L2: KV
  const data = await env.FUEL_KV.get(key, { type: 'json' });
  if (data) {
    memCache.set(key, { data, timestamp: now });
  }
  return data;
}

export async function putStations(country, stations, env) {
  const key = `stations:${country}`;
  await env.FUEL_KV.put(key, JSON.stringify(stations), {
    metadata: { updatedAt: new Date().toISOString(), count: stations.length },
  });
  // Update L1 too
  memCache.set(key, { data: stations, timestamp: Date.now() / 1000 });
}

/**
 * Grid-cell cache for Tier B countries.
 */
export async function getGridCache(key, env) {
  return env.FUEL_KV.get(key, { type: 'json' });
}

export async function putGridCache(key, data, env, ttlSeconds = 300) {
  await env.FUEL_KV.put(key, JSON.stringify(data), {
    expirationTtl: ttlSeconds,
  });
}
