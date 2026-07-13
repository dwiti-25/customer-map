import * as XLSX from "xlsx";

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
        company:
  row["Company Name"] ||
  row["Company"] ||
  row["Organization"] ||
  row["Customer"] ||
  row["Client"] ||
  "",

       person:
  row["Person's Name"] ||
  row["Contact Name"] ||
  row["Contact Person"] ||
  row["Name"] ||
  "",

        designation:
          row["Designation"] || "",

        city:
  row["City"] ||
  row["Location"] ||
  row["Town"] ||
  "",

        email:
          row["Email ID"] ||
          row["Email"] ||
          "",

        phone:
          row["Phone Number"] ||
          row["Phone"] ||
          "",

        application:
          row["Application Requested"] || "",

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