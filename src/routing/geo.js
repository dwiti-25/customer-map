const EARTH_RADIUS_KM = 6371;
const ROAD_WINDING_FACTOR = 1.3; // straight-line distance underestimates real road distance
const INTRACITY_SPEED_KMH = 30; // typical in-city driving speed with stops
const INTERCITY_SPEED_KMH = 55; // typical highway speed between cities

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function haversineKm(a, b) {
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(h));
}

export function estimateRoadKm(a, b) {
  return haversineKm(a, b) * ROAD_WINDING_FACTOR;
}

export function estimateIntracityHours(km) {
  return km / INTRACITY_SPEED_KMH;
}

export function estimateIntercityHours(km) {
  return km / INTERCITY_SPEED_KMH;
}

export function formatDistance(km) {
  return `${km.toFixed(1)} km`;
}

export function formatDuration(hours) {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}
