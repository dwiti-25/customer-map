const express = require("express");
const { z } = require("zod");
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();

const locationCreateSchema = z.object({
  type: z.enum(["PLANT", "CORPORATE_HQ"]),
  addressLine: z.string().optional(),
  city: z.string().min(1),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  googleMapsUrl: z.url().optional(),
  contactPerson: z.string().optional(),
  email: z.email().optional(),
  phone: z.string().optional(),
});

const locationUpdateSchema = locationCreateSchema.partial();

// Nested under /customers/:id since a location only ever exists in the
// context of its parent customer.
router.post("/customers/:id/locations", requireAuth, async (req, res) => {
  const customer = await prisma.customer.findFirst({
    where: { id: req.params.id, deletedAt: null },
  });
  if (!customer) {
    return res.status(404).json({ error: { message: "Customer not found" } });
  }

  const parsed = locationCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { message: "Invalid location data" } });
  }

  const location = await prisma.location.create({
    data: { ...parsed.data, customerId: customer.id, createdById: req.user.id },
  });

  res.status(201).json({ location });
});

router.patch("/locations/:id", requireAuth, async (req, res) => {
  const existing = await prisma.location.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    return res.status(404).json({ error: { message: "Location not found" } });
  }

  const parsed = locationUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { message: "Invalid location data" } });
  }

  const location = await prisma.location.update({
    where: { id: req.params.id },
    data: { ...parsed.data, updatedById: req.user.id },
  });

  res.json({ location });
});

router.delete("/locations/:id", requireAuth, async (req, res) => {
  const existing = await prisma.location.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    return res.status(404).json({ error: { message: "Location not found" } });
  }

  await prisma.location.delete({ where: { id: req.params.id } });

  res.status(204).send();
});

module.exports = router;
