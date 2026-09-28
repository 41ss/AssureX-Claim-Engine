/**
 * helpers.js — small generic utilities with no other natural home.
 */

/** Escape text before injecting into innerHTML to avoid breaking markup. */
export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Simple debounce, used for the search input. */
export function debounce(fn, wait = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/** Generate a display Claim ID in the CLM-#### format used across the app. */
export function generateClaimId(existingCount = 0) {
  const next = 12847 + existingCount + 1;
  return `CLM-${next}`;
}

/** Query-param helpers for simple multi-page routing (?id=CLM-0012847). */
export function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

export function setQueryParam(name, value) {
  const url = new URL(window.location.href);
  url.searchParams.set(name, value);
  window.history.replaceState({}, "", url);
}

/** Clamp a number between min/max — used for confidence bars etc. */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** Wait helper for simulating async backend latency in mock mode. */
export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
