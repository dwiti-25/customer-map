import * as XLSX from "xlsx";

export function exportLeadsToExcel(leads, filename = "mowito-leads-export.xlsx") {
  const rows = leads.map((lead) => ({
    "Company Name": lead.company || "",
    "Contact Person": lead.person || "",
    "Designation": lead.designation || "",
    "City": lead.city || "",
    "Email": lead.email || "",
    "Phone": lead.phone || "",
    "Application Requested": lead.application || "",
    "Source": lead.source || "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");

  XLSX.writeFile(workbook, filename);
}
