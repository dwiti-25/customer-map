const express = require("express");
const { z } = require("zod");
const { requireAuth } = require("../middleware/requireAuth");
const { getRoadRoute, geocodeAddress } = require("../lib/orsClient");

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

module.exports = router;
