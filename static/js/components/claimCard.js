/**
 * claimCard.js — a single row in the "Recent Claims" list and a
 * variant used inside the claims table.
 */
import { icon } from "./icons.js";
import { categoryIcon } from "../utils/claimOptions.js";
import { escapeHtml } from "../utils/helpers.js";
import { statusBadge } from "./statusBadge.js";
import { formatRelativeTime } from "../utils/formatters.js";

export function recentClaimRow(claim) {
  return `
    <a href="/claim-details?id=${claim.id}" class="recent-claim">
      <div class="icon-tile">${icon(categoryIcon(claim.product.category), { size: 18 })}</div>
      <div class="recent-claim__body">
        <div class="recent-claim__title">${claim.id}</div>
        <div class="recent-claim__sub">${escapeHtml(claim.product.name)} — ${escapeHtml(claim.faultType)}</div>
        ${statusBadge(claim.status)}
      </div>
      <div class="recent-claim__meta">
        <div class="recent-claim__time">${claim.submittedAt ? formatRelativeTime(claim.submittedAt) : "Draft"}</div>
      </div>
    </a>`;
}

export function claimTableRow(claim, { showActions = true } = {}) {
  return `
    <tr>
      <td data-label="Claim">
        <div class="claim-row">
          <div class="icon-tile">${icon(categoryIcon(claim.product.category), { size: 16 })}</div>
          <div>
            <div class="claim-id">${claim.id}</div>
            <div class="text-xs text-muted">${escapeHtml(claim.product.name)} · ${claim.product.id}</div>
          </div>
        </div>
      </td>
      <td data-label="Fault">${escapeHtml(claim.faultType)}</td>
      <td data-label="Status">${statusBadge(claim.status)}</td>
      <td data-label="Warranty">${statusBadge(claim.warranty.status || (claim.warranty.active ? "active" : "expired"))}</td>
      <td data-label="Submitted">${claim.submittedAt ? formatRelativeTime(claim.submittedAt) : "Draft"}</td>
      ${showActions ? `<td data-label="" class="col-actions">
        <a class="btn btn-secondary btn-sm" href="/claim-details?id=${claim.id}">${icon("eye", { size: 14 })}View</a>
      </td>` : ""}
    </tr>`;
}
