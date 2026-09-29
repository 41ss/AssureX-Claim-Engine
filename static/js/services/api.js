/**
 * api.js — the ONE place that knows how to reach the backend.
 *
 * Every other service imports `request()` from here instead of
 * calling fetch() directly. The backend is the FastAPI app serving
 * this page (src/main.py), so calls go to the same origin under /api
 * and the login session travels in a signed cookie.
 */

export const API_BASE_URL = "/api";

/**
 * request(path, options) — fetch wrapper for the backend.
 * Sends JSON unless the body is FormData (file uploads), and turns an
 * error response into an Error carrying the server's plain-language message.
 * A 401 (session expired) sends the user back to the login page.
 */
export async function request(path, options = {}) {
  const isForm = options.body instanceof FormData;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "same-origin",
    ...options,
    headers: { ...(isForm ? {} : { "Content-Type": "application/json" }), ...(options.headers || {}) },
  });

  if (!res.ok) {
    let message = `Request failed (${res.status}).`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") message = body.detail;
    } catch (err) {
      // Non-JSON error body: keep the generic message.
    }
    if (res.status === 401 && !path.startsWith("/auth/")) {
      localStorage.removeItem("assurex:session");
      window.location.href = "/login";
    }
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

/** download(path, fallbackName) — fetch a file from the backend and save it. */
export async function download(path, fallbackName) {
  const res = await fetch(`${API_BASE_URL}${path}`, { credentials: "same-origin" });
  if (!res.ok) throw new Error("We couldn't generate this file. Please try again.");
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^";]+)"?/);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = match ? match[1] : fallbackName;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
