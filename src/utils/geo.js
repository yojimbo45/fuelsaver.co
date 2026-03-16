/**
 * Haversine distance between two lat/lng points in km.
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Format distance for display.
 */
export function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/**
 * Create a GeoJSON circle polygon for MapLibre.
 */
export function createCircleGeoJSON(center, radiusKm, steps = 64) {
  const [lng, lat] = center;
  const coords = [];

  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dLat = (radiusKm / 111) * Math.cos(angle);
    const dLng = (radiusKm / (111 * Math.cos((lat * Math.PI) / 180))) * Math.sin(angle);
    coords.push([lng + dLng, lat + dLat]);
  }

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
  };
}
