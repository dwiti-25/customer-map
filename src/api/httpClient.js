const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
const TOKEN_KEY = "authToken";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// The single place every network request in the app goes through - React
// components never call fetch() directly, they call functions in src/api/*
// which call this.
export async function httpClient(path, { method = "GET", body, skipAuth = false } = {}) {
  const headers = { "Content-Type": "application/json" };

  if (!skipAuth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return null;

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && !skipAuth) {
      clearToken();
    }
    throw new ApiError(json?.error?.message || "Request failed", response.status);
  }

  return json;
}
