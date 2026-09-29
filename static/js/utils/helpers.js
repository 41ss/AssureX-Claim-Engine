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

/** Query-param helpers for simple multi-page routing (?id=CLM-0012847). */
export function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/** Clamp a number between min/max — used for confidence bars etc. */
