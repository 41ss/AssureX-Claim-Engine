/**
 * api.js — the ONE place that knows how to reach the backend.
 *
 * Every other service imports `request()` from here instead of
 * calling fetch() directly. When the backend team hands over real
 * endpoints, only this file (and each service's endpoint paths)
 * should need to change — the pages and components stay the same.
 *
 * MOCK MODE
 * ---------
 * USE_MOCK_DATA = true  -> services resolve from local mock data
 * USE_MOCK_DATA = false -> services call API_BASE_URL over fetch()
 *
 * The UI behaves identically in both modes. Toggle this one flag
 * (or the `?live=1` query param, for quick demos) to switch.
 */

export const API_BASE_URL = "https://api.assurex.example.com"; // TODO: Replace with confirmed backend endpoint.

const forcedLive = new URLSearchParams(window.location.search).get("live") === "1";
export const USE_MOCK_DATA = !forcedLive;

/** Simulated network latency so loading states are visible in mock mode. */
const MOCK_LATENCY_MS = 450;

/**
 * request(path, options) — thin fetch wrapper for the real backend.
 * Only used when USE_MOCK_DATA is false.
 */
export async function request(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  if (!res.ok) {
    const error = new Error(`Request failed: ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

/**
 * mockResolve(value) — wraps mock data in a Promise with a short
 * artificial delay, so callers can `await` mock and live services
 * identically.
 */
export function mockResolve(value) {
  return new Promise((resolve) => setTimeout(() => resolve(value), MOCK_LATENCY_MS));
}

/** mockReject(message) — simulate a failed backend call in mock mode. */
export function mockReject(message = "Something went wrong while connecting to ASSUREX.") {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), MOCK_LATENCY_MS));
}
