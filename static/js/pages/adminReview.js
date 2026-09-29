/**
 * pages/adminReview.js — /admin/review/:id equivalent.
 * With no ?id= in the URL, shows the full review queue.
 * With ?id=CLM-..., shows the detailed reviewer screen with
 * Approve / Reject / Request Information actions.
 * Reviewer decision logic itself belongs to the decision-engine
 * team — this page only forwards the reviewer's choice.
 */
import { adminService } from "../services/adminService.js";
import { icon } from "../components/icons.js";
import { statusBadge } from "../components/statusBadge.js";
import { claimTableRow } from "../components/claimCard.js";
import { navigate } from "../router.js";
import { skeletonLines, skeletonTableRows } from "../components/loadingState.js";
import { errorState, friendlyError } from "../components/errorState.js";
import { emptyState } from "../components/emptyState.js";
import { formatDate } from "../utils/formatters.js";
import { escapeHtml, getQueryParam } from "../utils/helpers.js";
import { modelComparisonCard, rulesCard, summaryCardImage } from "../components/analysisBlocks.js";
import { claimService } from "../services/claimService.js";
import { docTypeLabel } from "../utils/claimOptions.js";
import { openModal } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { debounce } from "../utils/helpers.js";

export async function renderAdminReviewPage(container) {
  const id = getQueryParam("id");
  if (id) return renderReviewDetail(container, id);
  return renderQueue(container);
}

async function renderQueue(container) {
  container.innerHTML = `
    <div class="page-header"><div><h2>Review Queue</h2><p class="text-sm">Claims flagged for manual review by the decision engine.</p></div></div>
    <div class="filter-bar">
      <div class="filter-bar__search search-input">${icon("search", { size: 16 })}<input id="review-search" placeholder="Search claim, product or fault..."></div>
      <div class="select-wrap"><select class="select" id="review-consistency"><option value="all">All model outcomes</option><option>Model Disagreement</option><option>Uncertain Result</option><option>Weak Match</option><option>Acceptable Match</option><option>Strong Match</option></select></div>
      <div class="select-wrap"><select class="select" id="review-warranty"><option value="all">Any warranty</option><option value="active">Active warranty</option><option value="expired">Expired warranty</option></select></div>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Claim</th><th>Fault</th><th>Status</th><th>Warranty</th><th>Submitted</th><th></th></tr></thead>
        <tbody id="queue-tbody">${skeletonTableRows(6, 6)}</tbody>
      </table>
    </div>`;

  const loadQueue = async () => {
    const tbody = document.getElementById("queue-tbody");
    tbody.innerHTML = skeletonTableRows(6, 6);
    try {
      const queue = await adminService.getReviewQueue({
        search: document.getElementById("review-search").value,
        consistency: document.getElementById("review-consistency").value,
        warranty: document.getElementById("review-warranty").value,
      });
      tbody.innerHTML = queue.length
        ? queue.map((c) => claimTableRow(c, { showActions: false }).replace("</tr>", `<td class="col-actions"><a class="btn btn-primary btn-sm" href="/admin-review?id=${c.id}">${icon("eye", { size: 14 })}Review</a></td></tr>`)).join("")
        : `<tr><td colspan="6">${emptyState({ title: "Queue is empty", body: "Nothing needs manual review right now." })}</td></tr>`;
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6">${errorState({ body: friendlyError(err), onRetry: loadQueue })}</td></tr>`;
    }
  };
  document.getElementById("review-search").addEventListener("input", debounce(loadQueue, 250));
  document.getElementById("review-consistency").addEventListener("change", loadQueue);
  document.getElementById("review-warranty").addEventListener("change", loadQueue);
  loadQueue();
}

async function renderReviewDetail(container, id) {
  container.innerHTML = `<div class="card">${skeletonLines(6)}</div>`;
  try {
    const claim = await adminService.getClaimReview(id);
    if (!claim) {
      container.innerHTML = errorState({ title: "Claim not found", body: `We couldn't find ${id}.` });
      return;
    }
    container.innerHTML = `
      <a href="/admin-review" class="btn btn-ghost btn-sm" style="margin-bottom:var(--space-3)">${icon("arrow-left", { size: 14 })}Back to Queue</a>
      <div class="page-header">
        <div><div style="display:flex;align-items:center;gap:var(--space-3)"><h2>${claim.id}</h2>${statusBadge(claim.status)}</div>
        <p class="text-sm">${escapeHtml(claim.product.name)} — ${escapeHtml(claim.faultType)} · ${escapeHtml(claim.stage)}</p></div>
      </div>

      <div class="claim-detail-grid">
        <div>
          <div class="card" style="margin-bottom:var(--space-4)">
            <div class="card__header"><div class="card__title">Claim & Product</div></div>
            <dl>
              <div class="detail-row"><dt>Product</dt><dd>${escapeHtml(claim.product.name)} (${claim.product.id})</dd></div>
              <div class="detail-row"><dt>Serial number</dt><dd>${escapeHtml(claim.product.serialNumber)}${claim.serialNumber && claim.serialNumber !== claim.product.serialNumber ? ` <span class="badge badge--warning">claim says ${escapeHtml(claim.serialNumber)}</span>` : ""}</dd></div>
              <div class="detail-row"><dt>Fault</dt><dd>${escapeHtml(claim.faultType)} · ${escapeHtml(claim.damageLabel || "")}</dd></div>
              <div class="detail-row"><dt>Fault date</dt><dd>${formatDate(claim.incidentDate)}</dd></div>
              <div class="detail-row"><dt>Previous repairs</dt><dd>${claim.repairCount ?? 0}${claim.unauthorizedRepairs ? ` (${claim.unauthorizedRepairs} unauthorised)` : ""}</dd></div>
              <div class="detail-row"><dt>Warranty</dt><dd class="detail-row__stack">${statusBadge(claim.warranty.status || (claim.warranty.active ? "active" : "expired"))}<span>${escapeHtml(claim.warranty.provider)} · until ${formatDate(claim.warranty.expiry)}</span></dd></div>
            </dl>
            <p style="margin-top:var(--space-3)">${escapeHtml(claim.description)}</p>
          </div>

          <div class="card" style="margin-bottom:var(--space-4)">
            <div class="card__header"><div class="card__title">Documents</div></div>
            ${claim.documents.length ? claim.documents.map((d) => `<div class="detail-row"><dt>${docTypeLabel(d.type)}</dt><dd><a href="${claimService.documentUrl(claim.id, d.id)}" target="_blank" rel="noopener" style="color:var(--text-link)">${escapeHtml(d.name)}</a>${d.duplicateOf ? ` <span class="badge badge--warning">also on ${escapeHtml(d.duplicateOf)}</span>` : ""}</dd></div>`).join("") : `<p class="text-sm text-muted">No documents uploaded.</p>`}
          </div>

          ${modelComparisonCard(claim.analysis)}

          ${claim.decision.contradictions.length
            ? `<div class="alert alert--danger" style="margin-bottom:var(--space-4)">${icon("alert-triangle", { size: 18 })}<div><div class="alert__title">Contradiction detected</div>${claim.decision.contradictions.map(escapeHtml).join("<br>")}</div></div>`
            : ""}
          ${claim.decision.missingDocuments.length
            ? `<div class="alert alert--warning" style="margin-bottom:var(--space-4)">${icon("alert-triangle", { size: 18 })}<div><div class="alert__title">Missing documents</div>${claim.decision.missingDocuments.map(escapeHtml).join(", ")}</div></div>`
            : ""}
          ${claim.decision.duplicateWarning
            ? `<div class="alert alert--info" style="margin-bottom:var(--space-4)">${icon("info", { size: 18 })}<div><div class="alert__title">Possible duplicate</div>${escapeHtml(claim.decision.duplicateWarning.reason || "")} Related claim: <a href="/admin-review?id=${claim.decision.duplicateWarning.relatedClaimId}">${claim.decision.duplicateWarning.relatedClaimId}</a></div></div>`
            : ""}
          ${rulesCard(claim.decision)}
          ${summaryCardImage(claim.analysis)}
        </div>

        <div>
          <div class="card" style="margin-bottom:var(--space-4)">
            <div class="card__header"><div class="card__title">Decision Engine Output</div></div>
            <h3 style="margin-bottom:var(--space-2)">${escapeHtml(claim.decision.result)}</h3>
            <p style="margin-bottom:var(--space-3)">${escapeHtml(claim.decision.explanation)}</p>
            ${claim.decision.supportingFactors.map((f) => `<div class="check-item is-done">${icon("check-circle-2", { size: 16 })}${escapeHtml(f)}</div>`).join("")}
            ${claim.decision.opposingFactors.map((f) => `<div class="check-item is-pending">${icon("x-circle", { size: 16 })}${escapeHtml(f)}</div>`).join("")}
          </div>

          <div class="card">
            <div class="card__header"><div class="card__title">Reviewer Action</div></div>
            <div class="field">
              <label class="field__label" for="reviewer-comment">Comment <span class="optional">(optional)</span></label>
              <textarea class="textarea" id="reviewer-comment" placeholder="Add context for the audit trail..."></textarea>
            </div>
            <div style="display:flex;flex-direction:column;gap:var(--space-2)">
              <button class="btn btn-primary btn-block" id="approve-btn">${icon("check-circle-2", { size: 15 })}Approve</button>
              <button class="btn btn-danger btn-block" id="reject-btn">${icon("x-circle", { size: 15 })}Reject</button>
              <button class="btn btn-secondary btn-block" id="request-info-btn">${icon("alert-triangle", { size: 15 })}Request Information</button>
            </div>
          </div>
          ${claim.auditHistory?.length ? `<div class="card" style="margin-top:var(--space-4)"><div class="card__header"><div class="card__title">Audit History</div></div><ol class="audit-list">${claim.auditHistory.map((entry) => `<li class="audit-item"><div class="audit-item__head"><strong>${escapeHtml(entry.action)}</strong><time>${new Date(entry.timestamp).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time></div><div class="text-xs text-muted">${escapeHtml(entry.actor)}${entry.detail ? ` — ${escapeHtml(entry.detail)}` : ""}</div></li>`).join("")}</ol></div>` : ""}
        </div>
      </div>`;

    wireActions(claim);
  } catch (err) {
    container.innerHTML = errorState({ body: friendlyError(err), onRetry: () => renderReviewDetail(container, id) });
  }
}

function wireActions(claim) {
  const comment = () => document.getElementById("reviewer-comment").value.trim();

  document.getElementById("approve-btn").addEventListener("click", () => {
    openModal({
      title: "Approve this claim?",
      body: claim.decision.result === "Likely Invalid"
        ? "The decision engine recommended Likely Invalid, so this is an override. Please give the reason in the comment — the original model results and your reason stay in the audit history."
        : "The original model results stay in the audit history.",
      confirmLabel: "Approve",
      onConfirm: () => submitAction(claim.id, "approve", comment()),
    });
  });
  document.getElementById("reject-btn").addEventListener("click", () => {
    openModal({
      title: "Reject this claim?",
      body: claim.decision.result === "Likely Valid"
        ? "The decision engine recommended Likely Valid, so this is an override. Please give the reason in the comment — it is kept in the audit history. The claimant will be notified."
        : "The claimant will be notified that the claim was rejected.",
      confirmLabel: "Reject",
      danger: true,
      onConfirm: () => submitAction(claim.id, "reject", comment()),
    });
  });
  document.getElementById("request-info-btn").addEventListener("click", () => submitAction(claim.id, "request_info", comment()));
}

async function submitAction(id, action, comment) {
  try {
    await adminService.submitReviewerAction(id, action, comment);
    showToast("Reviewer action recorded.", "success");
    setTimeout(() => { navigate("/admin-review"); }, 700);
  } catch (err) {
    showToast("We couldn't save this action. Please try again.", "error");
  }
}
