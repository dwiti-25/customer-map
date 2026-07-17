// One-time migration: imports the legacy Excel lead files into Postgres.
// Safe to re-run - already-imported rows (tracked via importTag +
// a recomputed dedupe key) are skipped, never duplicated.
//
// Usage: node scripts/importExistingData.js

require("dotenv").config({ quiet: true });
const path = require("path");
const XLSX = require("xlsx");
const { prisma } = require("../src/lib/prisma");

const PUBLIC_DIR = path.join(__dirname, "../../public");
const IMPORT_TAG = "LegacyCustomerImport";

const NA_VALUES = new Set(["na", "n/a", "none", "nil", "-", ""]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value) {
  if (value === undefined || value === null) return undefined;
  const str = String(value).trim();
  if (!str || NA_VALUES.has(str.toLowerCase())) return undefined;
  return str;
}

// Matches column headers loosely (case/whitespace/punctuation-insensitive) so
// quirks like a curly vs straight apostrophe, or a trailing space in a header,
// don't silently produce blank fields the way they do in the current
// frontend's loadLeads.js (see Sprint 6 report for details).
function normalizeKey(key) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getField(row, ...candidates) {
  const normalizedRow = {};
  for (const key of Object.keys(row)) {
    normalizedRow[normalizeKey(key)] = row[key];
  }
  for (const candidate of candidates) {
    const value = normalizedRow[normalizeKey(candidate)];
    const cleaned = clean(value);
    if (cleaned !== undefined) return cleaned;
  }
  return undefined;
}

function validEmailOrUndefined(email, context) {
  if (!email) return undefined;
  if (!EMAIL_PATTERN.test(email)) {
    console.warn(`  ! dropping malformed email "${email}" for ${context}`);
    return undefined;
  }
  return email;
}

function readEventSheet(filePath, legacyLabel) {
  const workbook = XLSX.readFile(filePath);
  const rows = [];

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    XLSX.utils.sheet_to_json(sheet).forEach((row) => {
      const companyName = getField(row, "Company Name", "Company", "Organization");
      if (!companyName) return;

      const contactPerson = getField(row, "Person's Name", "Contact Name", "Contact Person", "Name");
      const notesParts = [`[Legacy: ${legacyLabel}]`];
      const applicationNotes = getField(row, "Application Requested");
      if (applicationNotes) notesParts.push(applicationNotes);

      rows.push({
        companyName,
        contactPerson,
        designation: getField(row, "Designation"),
        phone: getField(row, "Phone Number", "Phone"),
        email: validEmailOrUndefined(getField(row, "Email ID", "Email"), companyName),
        city: getField(row, "City", "Location", "Town"),
        applicationNotes: notesParts.join(" "),
      });
    });
  });

  return rows;
}

function readReachoutList(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = [];

  XLSX.utils.sheet_to_json(sheet).forEach((row) => {
    const companyName = getField(row, "Name of Company", "Company Name");
    if (!companyName) return;

    const notesParts = ["[Legacy: Company Reachout List]"];
    const industryNote = getField(row, "Industry domian", "Industry domain");
    if (industryNote) notesParts.push(`[Legacy industry: ${industryNote}]`);

    rows.push({
      companyName,
      contactPerson: getField(row, "Contact Name"),
      designation: getField(row, "Contact Position"),
      phone: getField(row, "Contact Number"),
      email: validEmailOrUndefined(getField(row, "Email Id", "Email"), companyName),
      city: undefined, // this source has no location data at all
      applicationNotes: notesParts.join(" "),
    });
  });

  return rows;
}

function dedupeKey(row) {
  return [row.companyName, row.contactPerson, row.city, row.email, row.phone]
    .map((v) => (v || "").toLowerCase().trim())
    .join("|");
}

async function loadAlreadyImportedKeys() {
  const existing = await prisma.customer.findMany({
    where: { importTag: IMPORT_TAG },
    include: { locations: true },
  });

  return new Set(
    existing.map((c) =>
      dedupeKey({
        companyName: c.companyName,
        contactPerson: c.contactPerson,
        city: c.locations[0]?.city,
        email: c.email,
        phone: c.phone,
      })
    )
  );
}

async function main() {
  const sources = [
    ...readEventSheet(path.join(PUBLIC_DIR, "IMTEX_Leads.xlsx"), "IMTEX"),
    ...readEventSheet(path.join(PUBLIC_DIR, "ET Expo.xlsx"), "ET Expo"),
    ...readEventSheet(path.join(PUBLIC_DIR, "Chennai Automation Expo 2026 (1).xlsx"), "Chennai Expo"),
    ...readReachoutList(path.join(PUBLIC_DIR, "Mowitio_Company_Reachout_list.xlsx")),
  ];

  console.log(`Read ${sources.length} raw rows across 4 source files.`);

  const alreadyImported = await loadAlreadyImportedKeys();
  const seenThisRun = new Set();

  let created = 0;
  let skippedDuplicate = 0;
  let skippedNoCity = 0;

  for (const row of sources) {
    const key = dedupeKey(row);

    if (alreadyImported.has(key) || seenThisRun.has(key)) {
      skippedDuplicate++;
      continue;
    }
    seenThisRun.add(key);

    const customer = await prisma.customer.create({
      data: {
        companyName: row.companyName,
        contactPerson: row.contactPerson,
        designation: row.designation,
        email: row.email,
        phone: row.phone,
        applicationNotes: row.applicationNotes,
        industryId: null,
        importTag: IMPORT_TAG,
      },
    });

    if (row.city) {
      await prisma.location.create({
        data: {
          customerId: customer.id,
          type: "PLANT", // unverified guess - flagged via importTag for manual review
          city: row.city,
        },
      });
    } else {
      skippedNoCity++;
    }

    created++;
  }

  console.log(`Created ${created} customers (${skippedNoCity} with no location - no city in source data).`);
  console.log(`Skipped ${skippedDuplicate} duplicate rows (already imported or duplicate within this run).`);
}

main()
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
