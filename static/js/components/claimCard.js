/**
 * claimCard.js — a single row in the "Recent Claims" list and a
 * variant used inside the claims table.
 */
import { icon, productTypeIcon } from "./icons.js";
import { statusBadge } from "./statusBadge.js";
import { formatRelativeTime } from "../utils/formatters.js";

export function recentClaimRow(claim) {
  return `
    <a href="/claim-details?id=${claim.id}" class="recent-claim">
      <div class="icon-tile">${icon(productTypeIcon(claim.product.type), { size: 18 })}</div>
      <div class="recent-claim__body">
        <div class="recent-claim__title">${claim.id}</div>
        <div class="recent-claim__sub">${claim.product.name} — ${claim.faultType}</div>
      </div>
      <div class="recent-claim__meta">
        ${statusBadge(claim.status)}
        <div class="recent-claim__time">${formatRelativeTime(claim.submittedAt)}</div>
      </div>
    </a>`;
}

export function claimTableRow(claim, { showActions = true } = {}) {
  return `
    <tr>
      <td data-label="Claim">
        <div class="claim-row">
          <div class="icon-tile">${icon(productTypeIcon(claim.product.type), { size: 16 })}</div>
          <div>
            <div class="claim-id">${claim.id}</div>
            <div class="text-xs text-muted">${claim.product.name}</div>
          </div>
        </div>
      </td>
      <td data-label="Fault">${claim.faultType}</td>
      <td data-label="Status">${statusBadge(claim.status)}</td>
      <td data-label="Warranty">${claim.warranty.active ? statusBadge("active") : statusBadge("expired")}</td>
      <td data-label="Submitted">${formatRelativeTime(claim.submittedAt)}</td>
      ${showActions ? `<td data-label="" class="col-actions">
        <a class="btn btn-secondary btn-sm" href="/claim-details?id=${claim.id}">${icon("eye", { size: 14 })}View</a>
      </td>` : ""}
    </tr>`;
}
