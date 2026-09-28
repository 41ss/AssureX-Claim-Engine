/**
 * formatters.js
 * Small, dependency-free display formatters used across pages.
 * Keeping these in one place means a date-format change (a likely
 * live-judging request) only has to happen here.
 */

/** Format an ISO date string as "27 Sep 2026". */
export function formatDate(isoString, opts = {}) {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...opts,
  });
}

/** Format an ISO date string as a relative "2h ago" / "3d ago" label. */
export function formatRelativeTime(isoString) {
  if (!isoString) return "—";
  const then = new Date(isoString).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return formatDate(isoString);
}

/** Format a 0..1 confidence value as "92%". */
export function formatPercent(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

/** Format a number with thousands separators: 1482 -> "1,482". */
export function formatNumber(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("en-US");
}

/** Format a currency amount (KES by default). */
export function formatCurrency(value, currency = "KES") {
  if (value === null || value === undefined) return "—";
  return `${currency} ${Number(value).toLocaleString("en-US")}`;
}

/** Human file size: 245000 -> "239 KB". */
export function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i += 1;
  }
  return `${size.toFixed(size < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

/** Days between "now" and a target ISO date. Negative = already passed. */
export function daysUntil(isoString) {
  if (!isoString) return null;
  const target = new Date(isoString).setHours(0, 0, 0, 0);
  const today = new Date().setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

/** Turn a status string into title case for display: "under_review" -> "Under Review". */
export function titleCase(str) {
  if (!str) return "";
  return str
    .split(/[_\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Get initials from a full name for avatar chips: "Cyrus Ngugi" -> "CN". */
export function initials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}
