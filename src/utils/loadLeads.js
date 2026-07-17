import * as XLSX from "xlsx";

// Matches column headers loosely (case/whitespace/punctuation-insensitive) so
// a curly vs straight apostrophe in "Person's Name" - or any other stray
// whitespace/punctuation difference between source files - doesn't silently
// produce a blank field. This function is no longer called by the running
// app (data now comes from the backend API - see src/api/customers.js), but
// is kept correct here in case the Excel import path is ever reused.
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
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return undefined;
}

const files = [
  {
    path: "/IMTEX_Leads.xlsx",
    source: "IMTEX",
  },
  {
    path: "/ET Expo.xlsx",
    source: "ET Expo",
  },
  {
    path: "/Chennai Automation Expo 2026 (1).xlsx",
    source: "Chennai Expo",
  },
];

async function loadExcel(file) {
  const response = await fetch(file.path);
  const buffer = await response.arrayBuffer();

  const workbook = XLSX.read(buffer);

  let data = [];

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(sheet);

    rows.forEach((row) => {
      data.push({
        company: getField(row, "Company Name", "Company", "Organization", "Customer", "Client") || "",

        person: getField(row, "Person's Name", "Contact Name", "Contact Person", "Name") || "",

        designation: getField(row, "Designation") || "",

        city: getField(row, "City", "Location", "Town") || "",

        email: getField(row, "Email ID", "Email") || "",

        phone: getField(row, "Phone Number", "Phone") || "",

        application: getField(row, "Application Requested") || "",

        source: file.source,
      });
    });
  });
  console.log(file.source, data.length);
  return data;
}

export async function loadLeads() {
  let leads = [];

  for (const file of files) {
    try {
      const rows = await loadExcel(file);
      console.log(file.source, rows.length);
      leads.push(...rows);
    } catch (err) {
      console.error("Couldn't load:", file.path, err);
    }
  }

  // Remove only completely empty rows
  leads = leads.filter((lead) => {
    return (
      lead.company ||
      lead.person ||
      lead.city ||
      lead.email
    );
  });

  // Keep duplicate companies from different expos.
  // Only remove exact duplicate rows.

  const unique = new Map();

  leads.forEach((lead) => {
    const key = [
      lead.company,
      lead.person,
      lead.city,
      lead.email,
      lead.phone,
      lead.source,
    ]
      .join("|")
      .toLowerCase();

    if (!unique.has(key)) {
      unique.set(key, lead);
    }
  });

  console.log("Total Leads:", unique.size);

  return [...unique.values()];
}