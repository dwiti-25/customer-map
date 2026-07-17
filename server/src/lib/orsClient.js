const ORS_DIRECTIONS_URL = "https://api.openrouteservice.org/v2/directions/driving-car/geojson";
const ORS_GEOCODE_URL = "https://api.openrouteservice.org/geocode/search";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retries once on a network-level failure (DNS hiccup, connection reset,
// etc.) - these are usually transient and not worth immediately giving up
// on. Does NOT retry on an ORS-returned error response (4xx/5xx), since
// those are business-logic rejections (bad key, unroutable point) that a
// retry won't fix - callers handle those via response.ok themselves.
async function fetchWithRetry(url, options) {
  try {
    return await fetch(url, options);
  } catch (err) {
    await sleep(500);
    return fetch(url, options);
  }
}

// Calls OpenRouteService for a real road route through the given waypoints
// (internal [lat, lng] order - converted to ORS's [lng, lat] order here).
// Returns null on any failure (missing key, network error, bad response) so
// callers can fall back to the existing straight-line estimate. Never throws.
async function getRoadRoute(waypoints) {
  const apiKey = process.env.ORS_API_KEY;

  if (!apiKey) {
    return null;
  }

  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    return null;
  }

  try {
    const response = await fetchWithRetry(ORS_DIRECTIONS_URL, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        coordinates: waypoints.map(([lat, lng]) => [lng, lat]),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`ORS request failed (${response.status}):`, body);
      return null;
    }

    const data = await response.json();
    const feature = data?.features?.[0];
    const summary = feature?.properties?.summary;
    const coordinates = feature?.geometry?.coordinates;

    if (!summary || !Array.isArray(coordinates)) {
      console.error("ORS response missing expected fields");
      return null;
    }

    return {
      distanceKm: summary.distance / 1000,
      durationHours: summary.duration / 3600,
      geometry: coordinates.map(([lng, lat]) => [lat, lng]),
    };
  } catch (err) {
    console.error("ORS request error:", err.message);
    return null;
  }
}

// Looks up an address via OpenRouteService's geocoder. `focus` (optional
// {lat, lng}, e.g. the selected city's known center) biases results toward
// the right area when the address text alone is ambiguous. Returns null on
// any failure or zero results - never throws.
async function geocodeAddress(text, focus) {
  const apiKey = process.env.ORS_API_KEY;

  if (!apiKey || !text?.trim()) {
    return null;
  }

  try {
    // boundary.country restricts Pelias/ORS's free-text matching to India -
    // without it, a query like "Plot No. 1, Bidadi..." can fuzzy-match on
    // the substring "Plot No." alone and return a result in Pakistan/France/
    // wherever, since the geocoder has no country context to disambiguate.
    const params = new URLSearchParams({
      api_key: apiKey,
      text: text.trim(),
      size: "1",
      "boundary.country": "IND",
    });
    if (focus?.lat != null && focus?.lng != null) {
      params.set("focus.point.lat", String(focus.lat));
      params.set("focus.point.lon", String(focus.lng));
    }

    const response = await fetchWithRetry(`${ORS_GEOCODE_URL}?${params.toString()}`);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`ORS geocode failed (${response.status}):`, body);
      return null;
    }

    const data = await response.json();
    const feature = data?.features?.[0];
    const coordinates = feature?.geometry?.coordinates;

    if (!Array.isArray(coordinates)) {
      return null;
    }

    // Belt-and-suspenders check even with boundary.country set: reject
    // anything outside a rough India bounding box rather than silently
    // trusting a bad match.
    const [lng, lat] = coordinates;
    const withinIndia = lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98;
    if (!withinIndia) {
      console.error(`ORS geocode returned out-of-India result for "${text}":`, feature.properties?.label);
      return null;
    }

    return { latitude: lat, longitude: lng, label: feature.properties?.label || text };
  } catch (err) {
    console.error("ORS geocode error:", err.message);
    return null;
  }
}

module.exports = { getRoadRoute, geocodeAddress };
