import { httpClient, getToken, setToken, clearToken } from "./httpClient";

export function isLoggedIn() {
  return Boolean(getToken());
}

export async function login(email, password) {
  const { token, user } = await httpClient("/api/auth/login", {
    method: "POST",
    body: { email, password },
    skipAuth: true,
  });
  setToken(token);
  return user;
}

export async function fetchCurrentUser() {
  const { user } = await httpClient("/api/auth/me");
  return user;
}

export function logout() {
  clearToken();
}
