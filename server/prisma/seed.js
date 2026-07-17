require("dotenv").config({ quiet: true });
const { prisma } = require("../src/lib/prisma");

const INDUSTRIES = [
  "OEM",
  "System Integrator",
  "Machine Builder",
  "Packaging",
  "Automotive",
  "Food",
  "Electronics",
  "Pharma",
  "Logistics",
  "Other",
];

async function main() {
  for (const name of INDUSTRIES) {
    await prisma.industry.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log(`Seeded ${INDUSTRIES.length} industries.`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
