const express = require("express");
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();

// Read-only for now. Creating/editing/deleting industries is an admin
// feature that comes later (Sprint 8) - the fixed 10-value list is already
// seeded (Sprint 2), so the frontend dropdown has everything it needs today.
router.get("/industries", requireAuth, async (req, res) => {
  const industries = await prisma.industry.findMany({
    orderBy: { name: "asc" },
  });
  res.json({ data: industries });
});

module.exports = router;
