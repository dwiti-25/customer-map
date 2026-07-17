// One-time import of the researched industry/location enrichment data
// (server/scripts/data/enrichment-2026-07.json - one row per company location,
// grouped by pipe-separated customerIds) into the live Customer/Location
// tables. Safe to re-run: never overwrites a customer's already-set industry,
// and never overwrites a location that already has a real address/coordinates -
// it only fills in gaps left by the original Excel import.
//
// Usage: node scripts/importEnrichmentData.js [--dry-run]

require("dotenv").config({ quiet: true });
const fs = require("fs");
const path = require("path");
const { prisma } = require("../src/lib/prisma");

const CONFIDENCE_THRESHOLD = 40;
const DATA_FILE = path.join(__dirname, "data/enrichment-2026-07.json");
const DRY_RUN = process.argv.includes("--dry-run");

function canonicalCity(city) {
  const ALIASES = { Bengaluru: "Bangalore", Gurugram: "Gurgaon", Tiruchirappalli: "Trichy" };
  return ALIASES[city] || city;
}

// Matches company names loosely (trim/case/curly-vs-straight-apostrophe
// insensitive) - the same class of mismatch documented in loadLeads.js and
// importExistingData.js (e.g. "Airbus " vs "AIRBUS", curly vs straight
// apostrophe in "Manufacturers' Association").
function normalizeCompanyName(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[‘’]/g, "'");
}

async function main() {
  const rows = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));

  // The customerIds baked into the enrichment data file were computed against
  // a local dev database and don't match production's (fresh cuid()s are
  // generated per-database on import), so customers are re-matched here by
  // exact companyName against whichever database this script is actually
  // pointed at via DATABASE_URL.
  const byCompanyName = new Map();
  rows.forEach((row) => {
    if (!byCompanyName.has(row.company)) byCompanyName.set(row.company, []);
    byCompanyName.get(row.company).push(row);
  });

  const allCustomers = await prisma.customer.findMany({
    where: { deletedAt: null },
    select: { id: true, companyName: true },
  });
  const customersByNormalizedName = new Map();
  allCustomers.forEach((c) => {
    const key = normalizeCompanyName(c.companyName);
    if (!customersByNormalizedName.has(key)) customersByNormalizedName.set(key, []);
    customersByNormalizedName.get(key).push(c.id);
  });

  const byCustomerId = new Map();
  let companiesNotFound = 0;
  for (const [companyName, companyRows] of byCompanyName) {
    const matches = customersByNormalizedName.get(normalizeCompanyName(companyName)) || [];
    if (matches.length === 0) {
      companiesNotFound++;
      continue;
    }
    matches.forEach((id) => byCustomerId.set(id, companyRows));
  }
  console.log(`Matched ${byCustomerId.size} customer rows across ${byCompanyName.size - companiesNotFound}/${byCompanyName.size} researched companies (${companiesNotFound} company names not found in this database).`);

  let industriesSet = 0;
  let industriesSkippedAlreadySet = 0;
  let industriesSkippedLowConfidence = 0;
  let locationsCreated = 0;
  let locationsUpdated = 0;
  let locationsSkippedHasData = 0;
  let locationsSkippedLowConfidence = 0;
  let locationsSkippedNoAddress = 0;

  const industryCache = new Map();
  async function getIndustryId(name) {
    if (industryCache.has(name)) return industryCache.get(name);
    const industry = await prisma.industry.findUnique({ where: { name } });
    industryCache.set(name, industry?.id || null);
    return industry?.id || null;
  }

  for (const [customerId, companyRows] of byCustomerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { locations: true },
    });
    if (!customer || customer.deletedAt) continue;

    // --- Industry ---
    const industryRow = companyRows.find((r) => r.industry);
    if (industryRow) {
      if (customer.industryId) {
        industriesSkippedAlreadySet++;
      } else if ((industryRow.industryConfidence || 0) < CONFIDENCE_THRESHOLD) {
        industriesSkippedLowConfidence++;
      } else {
        const industryId = await getIndustryId(industryRow.industry);
        if (industryId) {
          industriesSet++;
          if (!DRY_RUN) {
            await prisma.customer.update({ where: { id: customerId }, data: { industryId } });
          }
        }
      }
    }

    // --- Locations ---
    for (const row of companyRows) {
      if (!row.locationType) continue;
      if (!row.fullAddress) {
        locationsSkippedNoAddress++;
        continue;
      }
      if ((row.confidence || 0) < CONFIDENCE_THRESHOLD) {
        locationsSkippedLowConfidence++;
        continue;
      }

      const type = row.locationType === "Corporate HQ" ? "CORPORATE_HQ" : "PLANT";
      const targetCity = canonicalCity(row.city || customer.locations[0]?.city || "");

      // Look for an existing location at the same (canonical) city with no
      // real address yet - that's the vague auto-imported row this enriches.
      const vagueMatch = customer.locations.find(
        (loc) =>
          canonicalCity(loc.city) === targetCity &&
          !loc.addressLine &&
          loc.latitude == null
      );

      // Already-imported check (idempotency): skip if this exact address is
      // already attached to this customer.
      const alreadyImported = customer.locations.some((loc) => loc.addressLine === row.fullAddress);
      if (alreadyImported) {
        locationsSkippedHasData++;
        continue;
      }

      if (vagueMatch) {
        locationsUpdated++;
        if (!DRY_RUN) {
          await prisma.location.update({
            where: { id: vagueMatch.id },
            data: {
              type,
              addressLine: row.fullAddress,
              city: row.city || vagueMatch.city,
              latitude: row.latitude || null,
              longitude: row.longitude || null,
              googleMapsUrl: row.googleMapsUrl || null,
            },
          });
          // Keep the in-memory copy in sync so a second location for the same
          // customer in this same pass doesn't re-match the same vague row.
          vagueMatch.addressLine = row.fullAddress;
          vagueMatch.latitude = row.latitude || null;
        }
      } else {
        locationsCreated++;
        if (!DRY_RUN) {
          const created = await prisma.location.create({
            data: {
              customerId,
              type,
              addressLine: row.fullAddress,
              city: row.city || customer.companyName,
              latitude: row.latitude || null,
              longitude: row.longitude || null,
              googleMapsUrl: row.googleMapsUrl || null,
            },
          });
          customer.locations.push(created);
        }
      }
    }
  }

  console.log(DRY_RUN ? "=== DRY RUN (no changes written) ===" : "=== APPLIED ===");
  console.log(`Industries set: ${industriesSet}`);
  console.log(`Industries skipped (already set): ${industriesSkippedAlreadySet}`);
  console.log(`Industries skipped (low confidence): ${industriesSkippedLowConfidence}`);
  console.log(`Locations updated (filled in vague row): ${locationsUpdated}`);
  console.log(`Locations created (new): ${locationsCreated}`);
  console.log(`Locations skipped (already has this address): ${locationsSkippedHasData}`);
  console.log(`Locations skipped (low confidence): ${locationsSkippedLowConfidence}`);
  console.log(`Locations skipped (no address researched): ${locationsSkippedNoAddress}`);
}

main()
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
