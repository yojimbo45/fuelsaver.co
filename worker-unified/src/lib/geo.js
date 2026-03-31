export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Filter stations by bounding box then haversine distance.
 * Returns top `limit` stations sorted by distance.
 */
export function filterByDistance(stations, lat, lng, radiusKm, limit = 100) {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

  return stations
    .filter(
      (s) =>
        s.lat >= lat - dLat &&
        s.lat <= lat + dLat &&
        s.lng >= lng - dLng &&
        s.lng <= lng + dLng
    )
    .map((s) => ({
      ...s,
      distance: Math.round(haversine(lat, lng, s.lat, s.lng) * 100) / 100,
    }))
    .filter((s) => s.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

/**
 * Compute grid cell center for Tier B caching.
 * Rounds to 0.1 degree (~11km grid).
 */
export function gridCell(lat, lng) {
  return {
    lat: Math.round(lat * 10) / 10,
    lng: Math.round(lng * 10) / 10,
  };
}
