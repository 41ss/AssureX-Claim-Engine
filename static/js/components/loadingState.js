/**
 * loadingState.js — skeleton placeholders so screens are never
 * completely blank while data loads.
 */
export function skeletonCards(count = 4) {
  return Array.from({ length: count }).map(() => `<div class="skeleton skeleton-card"></div>`).join("");
}

export function skeletonLines(count = 3, widths = ["100%", "80%", "60%"]) {
  return Array.from({ length: count })
    .map((_, i) => `<div class="skeleton skeleton-line" style="width:${widths[i % widths.length]}"></div>`)
    .join("");
}

export function skeletonTableRows(rows = 5, cols = 5) {
  const cells = Array.from({ length: cols }).map(() => `<td><div class="skeleton skeleton-line" style="width:80%"></div></td>`).join("");
  return Array.from({ length: rows }).map(() => `<tr>${cells}</tr>`).join("");
}
