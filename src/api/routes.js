import { httpClient } from "./httpClient";

// Returns null (never throws) if real road routing isn't available for any
// reason - the backend already normalizes ORS failures to { route: null },
// and a network/auth error talking to our own backend is treated the same
// way here, so callers always have a single "use the fallback" signal.
export async function fetchRoadRoute(waypoints) {
  try {
    const { route } = await httpClient("/api/routes/directions", {
      method: "POST",
      body: { waypoints },
    });
    return route;
  } catch (err) {
    console.error("Road routing unavailable, falling back to straight-line:", err.message);
    return null;
  }
}

// Returns null (never throws) if the address can't be located - callers
// should leave the map pin where it was rather than error out.
export async function geocodeAddress(address, focusCoordinates) {
  try {
    const { result } = await httpClient("/api/routes/geocode", {
      method: "POST",
      body: {
        address,
        focusLat: focusCoordinates?.[0],
        focusLng: focusCoordinates?.[1],
      },
    });
    return result;
  } catch (err) {
    console.error("Geocoding unavailable:", err.message);
    return null;
  }
}

// Returns null (never throws) if no coordinates could be extracted from the
// URL (unrecognized format, dead short link, etc.) - callers should fall
// back to geocoding the address field.
export async function resolveMapsUrl(url) {
  try {
    const { result } = await httpClient("/api/routes/resolve-maps-url", {
      method: "POST",
      body: { url },
    });
    return result;
  } catch (err) {
    console.error("Resolving Maps URL failed:", err.message);
    return null;
  }
}
