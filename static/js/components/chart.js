/**
 * chart.js — small dependency-free SVG chart renderers.
 *
 * The brief asks for restraint over "excessive" visuals, and pulling
 * in a full charting library for three simple chart types didn't
 * feel justified, so these are hand-rolled SVG builders. Swap any
 * of them for Chart.js/Recharts later without touching callers —
 * each function just returns an <svg> string given data.
 */

const CHART_COLORS = {
  approved: "#145C4A",
  rejected: "#C4694E",
  review: "#8C7FD1",
};

/** Build a smooth-ish area/line path from a list of {x,y} points. */
function buildPath(points) {
  if (!points.length) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    d += ` Q ${prev.x} ${prev.y} ${midX} ${(prev.y + curr.y) / 2}`;
    d += ` Q ${midX} ${(prev.y + curr.y) / 2} ${curr.x} ${curr.y}`;
  }
  return d;
}

/**
 * multiSeriesAreaChart({ labels, series }) — series: [{ key, values, color }]
 * Renders a layered area+line chart similar to the reference dashboard.
 */
export function multiSeriesAreaChart({ labels, series, width = 640, height = 220 }) {
  const padding = { top: 16, right: 16, bottom: 28, left: 36 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const maxVal = Math.max(...series.flatMap((s) => s.values)) * 1.15 || 1;
  const stepX = innerW / (labels.length - 1 || 1);

  const toPoints = (values) =>
    values.map((v, i) => ({
      x: padding.left + i * stepX,
      y: padding.top + innerH - (v / maxVal) * innerH,
    }));

  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => {
      const y = padding.top + innerH * (1 - f);
      return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="var(--border-subtle)" stroke-width="1"/>`;
    })
    .join("");

  const areas = series
    .map((s) => {
      const pts = toPoints(s.values);
      const linePath = buildPath(pts);
      const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${padding.top + innerH} L ${pts[0].x} ${padding.top + innerH} Z`;
      const color = s.color || CHART_COLORS[s.key] || "#145C4A";
      return `
        <path d="${areaPath}" fill="${color}" opacity="0.12"></path>
        <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round"></path>`;
    })
    .join("");

  const xLabels = labels
    .map((l, i) => {
      const x = padding.left + i * stepX;
      return `<text x="${x}" y="${height - 6}" font-size="10" fill="var(--text-muted)" text-anchor="middle">${l}</text>`;
    })
    .join("");

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Claims overview chart">${gridLines}${areas}${xLabels}</svg>`;
}

/** simpleDonutChart({ labels, values, colors }) — claim outcome breakdown. */
export function simpleDonutChart({ values, colors, size = 140, strokeWidth = 22 }) {
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offsetAcc = 0;

  const segments = values
    .map((v, i) => {
      const fraction = v / total;
      const dash = fraction * circumference;
      const seg = `<circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none"
        stroke="${colors[i]}" stroke-width="${strokeWidth}"
        stroke-dasharray="${dash} ${circumference - dash}"
        stroke-dashoffset="${-offsetAcc}"
        transform="rotate(-90 ${size / 2} ${size / 2})" />`;
      offsetAcc += dash;
      return seg;
    })
    .join("");

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Claim outcome breakdown">${segments}</svg>`;
}

/** simpleBarChart({ labels, values }) — claims by product category. */
export function simpleBarChart({ labels, values, width = 320, height = 180, color = "var(--color-forest)" }) {
  const padding = { top: 10, right: 10, bottom: 26, left: 10 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const maxVal = Math.max(...values) * 1.15 || 1;
  const gap = 10;
  const barW = innerW / values.length - gap;

  const bars = values
    .map((v, i) => {
      const barH = (v / maxVal) * innerH;
      const x = padding.left + i * (barW + gap);
      const y = padding.top + innerH - barH;
      const label = labels[i];
      return `
        <rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="4" fill="${color}" opacity="${0.55 + i * 0.08}"></rect>
        <text x="${x + barW / 2}" y="${height - 6}" font-size="9" fill="var(--text-muted)" text-anchor="middle">${label}</text>`;
    })
    .join("");

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Claims by product category">${bars}</svg>`;
}
