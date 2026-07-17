import { httpClient } from "./httpClient";

const PAGE_SIZE = 100;

// The backend paginates GET /api/customers; the frontend's map/sidebar/search
// still work over one in-memory array (unchanged from before this migration),
// so this loops through every page and hands back the full list.
export async function fetchAllCustomers() {
  let offset = 0;
  let all = [];

  while (true) {
    const { data, total } = await httpClient(`/api/customers?limit=${PAGE_SIZE}&offset=${offset}`);
    all = all.concat(data);
    offset += PAGE_SIZE;
    if (data.length === 0 || all.length >= total) break;
  }

  return all;
}

export async function createCustomer(fields) {
  const { customer } = await httpClient("/api/customers", { method: "POST", body: fields });
  return customer;
}

export async function updateCustomer(id, fields) {
  const { customer } = await httpClient(`/api/customers/${id}`, { method: "PATCH", body: fields });
  return customer;
}

export async function deleteCustomer(id) {
  await httpClient(`/api/customers/${id}`, { method: "DELETE" });
}
