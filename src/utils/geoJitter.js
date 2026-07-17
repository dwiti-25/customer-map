// Deterministically spreads out customers that share the same city-center
// coordinate, so markers don't overlap but also don't move between renders.
function hashSeed(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return hash;
}

function pseudoRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function jitterCoordinates([lat, lng], seed, magnitude = 0.02) {
  const base = hashSeed(seed);
  const offsetLat = (pseudoRandom(base) - 0.5) * magnitude;
  const offsetLng = (pseudoRandom(base + 1) - 0.5) * magnitude;
  return [lat + offsetLat, lng + offsetLng];
}
