/**
 * statCard.js — one KPI card (Total Claims, Approved, Rejected, ...)
 */
import { icon } from "./icons.js";
import { formatNumber } from "../utils/formatters.js";

export function statCard({ label, value, deltaPct, direction, iconName, tone = "forest" }) {
  const deltaCls = direction === "up" ? "is-up" : direction === "down" ? "is-down" : "";
  const sign = deltaPct > 0 ? "+" : "";
  return `
    <div class="stat-card">
      <div class="stat-card__icon stat-card__icon--${tone}">${icon(iconName, { size: 20 })}</div>
      <div>
        <div class="stat-card__label">${label}</div>
        <div class="stat-card__value font-numeric">${formatNumber(value)}</div>
        <div class="stat-card__delta ${deltaCls}">${sign}${deltaPct}% vs last 7 days</div>
      </div>
    </div>`;
}
