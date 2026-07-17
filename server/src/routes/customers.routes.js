const express = require("express");
const { z } = require("zod");
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();

const customerCreateSchema = z.object({
  companyName: z.string().min(1),
  contactPerson: z.string().optional(),
  designation: z.string().optional(),
  email: z.email().optional(),
  phone: z.string().optional(),
  applicationNotes: z.string().optional(),
  industryId: z.string().optional(),
});

const customerUpdateSchema = customerCreateSchema.partial();

async function assertIndustryExists(industryId) {
  if (!industryId) return true;
  const industry = await prisma.industry.findUnique({ where: { id: industryId } });
  return Boolean(industry);
}

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

router.get("/customers", requireAuth, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  const where = { deletedAt: null };

  if (req.query.industryId) {
    where.industryId = req.query.industryId;
  }

  if (req.query.city) {
    where.locations = { some: { city: { equals: req.query.city, mode: "insensitive" } } };
  }

  if (req.query.search) {
    where.OR = [
      { companyName: { contains: req.query.search, mode: "insensitive" } },
      { contactPerson: { contains: req.query.search, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: { industry: true, locations: true },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.customer.count({ where }),
  ]);

  res.json({ data, total, limit, offset });
});

router.post("/customers", requireAuth, async (req, res) => {
  const parsed = customerCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { message: "Invalid customer data" } });
  }

  const { industryId } = parsed.data;
  if (!(await assertIndustryExists(industryId))) {
    return res.status(400).json({ error: { message: "industryId does not reference an existing industry" } });
  }

  const customer = await prisma.customer.create({
    data: { ...parsed.data, createdById: req.user.id },
    include: { industry: true },
  });

  res.status(201).json({ customer });
});

router.get("/customers/:id", requireAuth, async (req, res) => {
  const customer = await prisma.customer.findFirst({
    where: { id: req.params.id, deletedAt: null },
    include: { industry: true, locations: true },
  });

  if (!customer) {
    return res.status(404).json({ error: { message: "Customer not found" } });
  }

  res.json({ customer });
});

router.patch("/customers/:id", requireAuth, async (req, res) => {
  const parsed = customerUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { message: "Invalid customer data" } });
  }

  const { industryId } = parsed.data;
  if (industryId !== undefined && !(await assertIndustryExists(industryId))) {
    return res.status(400).json({ error: { message: "industryId does not reference an existing industry" } });
  }

  const existing = await prisma.customer.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!existing) {
    return res.status(404).json({ error: { message: "Customer not found" } });
  }

  const customer = await prisma.customer.update({
    where: { id: req.params.id },
    data: { ...parsed.data, updatedById: req.user.id },
    include: { industry: true },
  });

  res.json({ customer });
});

router.delete("/customers/:id", requireAuth, async (req, res) => {
  const existing = await prisma.customer.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!existing) {
    return res.status(404).json({ error: { message: "Customer not found" } });
  }

  await prisma.customer.update({
    where: { id: req.params.id },
    data: { deletedAt: new Date(), updatedById: req.user.id },
  });

  res.status(204).send();
});

module.exports = router;
