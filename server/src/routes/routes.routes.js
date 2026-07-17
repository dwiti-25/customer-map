const express = require("express");
const { z } = require("zod");
const { requireAuth } = require("../middleware/requireAuth");
const { getRoadRoute, geocodeAddress } = require("../lib/orsClient");
const { parseGoogleMapsUrl } = require("../lib/googleMapsUrl");

const router = express.Router();

const directionsSchema = z.object({
  waypoints: z.array(z.tuple([z.number(), z.number()])).min(2),
});

// Returns { route: null } (200, not an error) when OpenRouteService is
// unavailable/unconfigured/fails - the frontend treats that as an expected
// signal to fall back to its existing straight-line estimate.
router.post("/routes/directions", requireAuth, async (req, res) => {
  const parsed = directionsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { message: "Invalid waypoints" } });
  }

  const route = await getRoadRoute(parsed.data.waypoints);

  res.json({ route });
});

const geocodeSchema = z.object({
  address: z.string().min(1),
  focusLat: z.number().optional(),
  focusLng: z.number().optional(),
});

// Returns { result: null } (200, not an error) when the address can't be
// located - the frontend falls back to leaving the pin where it was.
router.post("/routes/geocode", requireAuth, async (req, res) => {
  const parsed = geocodeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { message: "Invalid geocode request" } });
  }

  const { address, focusLat, focusLng } = parsed.data;
  const focus = focusLat != null && focusLng != null ? { lat: focusLat, lng: focusLng } : undefined;
  const result = await geocodeAddress(address, focus);

  res.json({ result });
});

const mapsUrlSchema = z.object({
  url: z.string().min(1),
});

// Returns { result: null } (200, not an error) when no coordinates could be
// extracted from the URL (unrecognized format, dead short link, etc.) - the
// frontend falls back to geocoding the address field.
router.post("/routes/resolve-maps-url", requireAuth, async (req, res) => {
  const parsed = mapsUrlSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { message: "Invalid Google Maps URL" } });
  }

  console.log("[DEBUG maps-url] request received, url:", parsed.data.url);
  const result = await parseGoogleMapsUrl(parsed.data.url);
  console.log("[DEBUG maps-url] responding with:", result);

  res.json({ result });
});

module.exports = router;
