// Default to same-origin relative URLs. In development the Vite dev server
// proxies /users, /transactions, /budgets and /reports to the FastAPI backend
// (see vite.config.js), so the browser never makes a cross-origin request and
// the app does not depend on a specific backend port being free. Set
// VITE_API_BASE_URL only when the API lives on a different origin, e.g. a
// deployed backend.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export function getToken() {
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token")
  );
}

export function setToken(token, rememberMe = true) {
  clearToken();
  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem("access_token", token);
}

export function clearToken() {
  localStorage.removeItem("access_token");
  sessionStorage.removeItem("access_token");
}

export async function apiRequest(path, options = {}) {
  const token = getToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (options.body && !(options.body instanceof URLSearchParams)) {
    headers.set("Content-Type", "application/json");
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    const networkError = new Error(
      "Could not reach the server. Make sure the backend is running.",
    );
    networkError.status = 0;
    throw networkError;
  }

  // A 401 on a normal authenticated request means the session expired, so send
  // the user back to login. On the login request itself it just means bad
  // credentials and must surface to the caller instead of redirecting.
  if (response.status === 401 && path !== "/users/login") {
    clearToken();
    window.location.href = "/";
    throw new Error("Please log in again.");
  }

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.detail || "Something went wrong.");
    error.status = response.status;
    throw error;
  }

  return data;
}
