import * as XLSX from "xlsx";

export function exportLeadsToExcel(leads, filename = "mowito-leads-export.xlsx") {
  const rows = leads.map((lead) => ({
    "Company Name": lead.company || "",
    "Contact Person": lead.person || "",
    "Designation": lead.designation || "",
    "Industry": lead.industryName || "",
    "Location Type": lead.locationType === "CORPORATE_HQ" ? "Corporate HQ" : lead.locationType === "PLANT" ? "Plant" : "",
    "City": lead.city || "",
    "Address": lead.addressLine || "",
    "Google Maps URL": lead.googleMapsUrl || "",
    "Email": lead.email || "",
    "Phone": lead.phone || "",
    "Application Requested": lead.application || "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");

  XLSX.writeFile(workbook, filename);
}
