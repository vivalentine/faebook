export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || ""
).replace(/\/$/, "");

export function apiUrl(path: string) {
  if (!path.startsWith("/")) {
    return API_BASE_URL ? `${API_BASE_URL}/${path}` : `/${path}`;
  }

  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || undefined);

  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(apiUrl(path), {
    ...options,
    headers,
    credentials: "include",
  });
}
