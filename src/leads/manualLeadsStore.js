const STORAGE_KEY = "manualLeads";

function readFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to read manual leads:", e);
    return [];
  }
}

function writeToStorage(leads) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  return leads;
}

export function getManualLeads() {
  return readFromStorage();
}

export function addManualLead(fields) {
  const leads = readFromStorage();

  const newLead = {
    ...fields,
    id: crypto.randomUUID(),
    isManual: true,
  };

  return writeToStorage([...leads, newLead]);
}

export function updateManualLead(id, fields) {
  const leads = readFromStorage();

  const updated = leads.map((lead) =>
    lead.id === id ? { ...lead, ...fields, id, isManual: true } : lead
  );

  return writeToStorage(updated);
}

export function deleteManualLead(id) {
  const leads = readFromStorage();
  return writeToStorage(leads.filter((lead) => lead.id !== id));
}
