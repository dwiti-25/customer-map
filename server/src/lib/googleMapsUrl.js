// Extracts a latitude/longitude pair directly out of a pasted Google Maps
// URL, without ever calling a geocoder - the coordinates are already in the
// URL for most Maps link formats, this just has to find them.
//
// Supported formats (checked in this order, most precise first):
//   !3d<lat>!4d<lng>          - the actual pin coordinate embedded in a
//                               place link's data blob (most accurate -
//                               the /@lat,lng in the same URL is often just
//                               the viewport center, which can differ)
//   ?q=<lat>,<lng>            - google.com/maps?q=12.34,56.78
//   /@<lat>,<lng>,<zoom>z     - google.com/maps/@12.34,56.78,15z or
//                               .../maps/place/Name/@12.34,56.78,15z
//   ?ll=<lat>,<lng>           - legacy Google Maps links
//
// maps.app.goo.gl / goo.gl/maps short links carry no coordinates in the URL
// itself - resolveShortLink follows the redirect server-side first to get
// the real, expandable URL before any of the above patterns can match.

const COORD_PATTERNS = [
  { name: "place-data-3d4d", regex: /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/ },
  { name: "query-q-param", regex: /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/ },
  { name: "at-viewport-center", regex: /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/ },
  { name: "legacy-ll-param", regex: /[?&]ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/ },
];

const SHORT_LINK_HOSTS = ["goo.gl", "maps.app.goo.gl"];

function isShortLink(url) {
  try {
    const host = new URL(url).hostname;
    return SHORT_LINK_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

// Follows redirects server-side (fetch's redirect: "follow" gives us the
// final response.url) so the short link never has to touch the browser.
// Returns the original url unchanged on any failure - never throws.
async function resolveShortLink(url) {
  try {
    const response = await fetch(url, { method: "GET", redirect: "follow" });
    return response.url || url;
  } catch (err) {
    console.error("Failed to resolve Maps short link:", err.message);
    return url;
  }
}

function extractCoordinates(url) {
  for (const { name, regex } of COORD_PATTERNS) {
    const match = url.match(regex);
    if (match) {
      const latitude = parseFloat(match[1]);
      const longitude = parseFloat(match[2]);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return { latitude, longitude, matchedPattern: name };
      }
    }
  }
  return null;
}

// Returns { latitude, longitude, matchedPattern, resolvedUrl } or null.
// Never throws - any failure (bad URL, network error resolving a short
// link, no pattern match) just results in null so the caller can fall back
// to geocoding the address instead.
async function parseGoogleMapsUrl(originalUrl) {
  let workingUrl = originalUrl;

  if (isShortLink(originalUrl)) {
    workingUrl = await resolveShortLink(originalUrl);
  }

  const result = extractCoordinates(workingUrl);
  if (!result) return null;
  return { ...result, resolvedUrl: workingUrl };
}

module.exports = { parseGoogleMapsUrl };
