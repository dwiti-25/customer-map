import { httpClient } from "./httpClient";

// Not wired into any UI yet - the Add/Edit Lead form still uses the
// free-text Source field to preserve the current UI exactly. This is ready
// for whenever a future sprint replaces Source with a real Industry picker.
export async function fetchIndustries() {
  const { data } = await httpClient("/api/industries");
  return data;
}
