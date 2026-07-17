import { httpClient } from "./httpClient";

export async function createLocation(customerId, fields) {
  const { location } = await httpClient(`/api/customers/${customerId}/locations`, {
    method: "POST",
    body: fields,
  });
  return location;
}

export async function updateLocation(id, fields) {
  const { location } = await httpClient(`/api/locations/${id}`, { method: "PATCH", body: fields });
  return location;
}

export async function deleteLocation(id) {
  await httpClient(`/api/locations/${id}`, { method: "DELETE" });
}
