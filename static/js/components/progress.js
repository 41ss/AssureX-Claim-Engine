/**
 * progress.js — linear progress bar + readiness ring (SVG circle).
 */
export function progressBar(pct) {
  const clamped = Math.max(0, Math.min(100, pct));
  return `<div class="progress"><div class="progress__fill" style="width:${clamped}%"></div></div>`;
}

/** A circular "readiness"/confidence ring drawn with plain SVG (no chart library). */
export function ring(pct, { size = 96, stroke = 8, color = "var(--color-forest)", label } = {}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(1, pct)));
  return `
    <div class="ring" style="--ring-size:${size}px">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="var(--border-subtle)" stroke-width="${stroke}"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="${color}" stroke-width="${stroke}"
          stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"/>
      </svg>
      <span class="ring__value">${label ?? Math.round(pct * 100) + "%"}</span>
    </div>`;
}
