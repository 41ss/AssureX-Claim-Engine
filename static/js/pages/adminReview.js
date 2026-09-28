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
import { skeletonLines, skeletonTableRows } from "../components/loadingState.js";
import { errorState, friendlyError } from "../components/errorState.js";
import { emptyState } from "../components/emptyState.js";
import { formatPercent } from "../utils/formatters.js";
import { getQueryParam } from "../utils/helpers.js";
import { openModal } from "../components/modal.js";
import { showToast } from "../components/toast.js";

export async function renderAdminReviewPage(container) {
  const id = getQueryParam("id");
  if (id) return renderReviewDetail(container, id);
  return renderQueue(container);
}

async function renderQueue(container) {
  container.innerHTML = `
    <div class="page-header"><div><h2>Review Queue</h2><p class="text-sm">Claims flagged for manual review by the decision engine.</p></div></div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Claim</th><th>Fault</th><th>Status</th><th>Warranty</th><th>Submitted</th><th></th></tr></thead>
        <tbody id="queue-tbody">${skeletonTableRows(6, 6)}</tbody>
      </table>
    </div>`;

  const tbody = document.getElementById("queue-tbody");
  try {
    const queue = await adminService.getReviewQueue();
    tbody.innerHTML = queue.length
      ? queue
          .map((c) =>
            claimTableRow(c, { showActions: false }).replace(
              "</tr>",
              `<td class="col-actions"><a class="btn btn-primary btn-sm" href="/admin-review?id=${c.id}">${icon("eye", { size: 14 })}Review</a></td></tr>`
            )
          )
          .join("")
      : `<tr><td colspan="6">${emptyState({ title: "Queue is empty", body: "Nothing needs manual review right now." })}</td></tr>`;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6">${errorState({ body: friendlyError(err), onRetry: () => renderQueue(container) })}</td></tr>`;
  }
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
        <p class="text-sm">${claim.product.name} — ${claim.faultType}</p></div>
      </div>

      <div class="claim-detail-grid">
        <div>
          <div class="card" style="margin-bottom:var(--space-4)">
            <div class="card__header"><div class="card__title">Claim & Product</div></div>
            <dl>
              <div class="detail-row"><dt>Serial number</dt><dd>${claim.product.serialNumber}</dd></div>
              <div class="detail-row"><dt>Fault</dt><dd>${claim.faultType}</dd></div>
              <div class="detail-row"><dt>Warranty</dt><dd>${claim.warranty.provider} — ${claim.warranty.active ? statusBadge("active") : statusBadge("expired")}</dd></div>
            </dl>
            <p style="margin-top:var(--space-3)">${claim.description}</p>
          </div>

          <div class="card" style="margin-bottom:var(--space-4)">
            <div class="card__header"><div class="card__title">Model Comparison</div></div>
            <div class="detail-row"><dt>Python Model</dt><dd>${claim.analysis.modelOne.prediction} (${formatPercent(claim.analysis.modelOne.confidence.valid)})</dd></div>
            <div class="detail-row"><dt>Teachable Machine</dt><dd>${claim.analysis.modelTwo.prediction} (${formatPercent(claim.analysis.modelTwo.confidence.valid)})</dd></div>
            <div class="detail-row"><dt>Consistency</dt><dd>${claim.analysis.consistency}</dd></div>
          </div>

          ${claim.decision.contradictions.length
            ? `<div class="alert alert--danger" style="margin-bottom:var(--space-4)">${icon("alert-triangle", { size: 18 })}<div><div class="alert__title">Contradiction detected</div>${claim.decision.contradictions.map((c) => `${c.field}: ${c.detail}`).join("<br>")}</div></div>`
            : ""}
          ${claim.decision.missingDocuments.length
            ? `<div class="alert alert--warning" style="margin-bottom:var(--space-4)">${icon("alert-triangle", { size: 18 })}<div><div class="alert__title">Missing documents</div>${claim.decision.missingDocuments.join(", ")}</div></div>`
            : ""}
          ${claim.decision.duplicateWarning
            ? `<div class="alert alert--info" style="margin-bottom:var(--space-4)">${icon("info", { size: 18 })}<div><div class="alert__title">Possible duplicate</div>Related to ${claim.decision.duplicateWarning.relatedClaimId}</div></div>`
            : ""}
        </div>

        <div>
          <div class="card" style="margin-bottom:var(--space-4)">
            <div class="card__header"><div class="card__title">Decision Engine Output</div></div>
            <h3 style="margin-bottom:var(--space-2)">${claim.decision.result}</h3>
            <p>${claim.decision.explanation}</p>
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
      body: "This overrides the automated recommendation if it differs. The original AI results stay in the audit history.",
      confirmLabel: "Approve",
      onConfirm: () => submitAction(claim.id, "approve", comment()),
    });
  });
  document.getElementById("reject-btn").addEventListener("click", () => {
    openModal({
      title: "Reject this claim?",
      body: "The claimant will be notified that the claim was rejected.",
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
    setTimeout(() => { window.location.href = "/admin-review"; }, 700);
  } catch (err) {
    showToast("We couldn't save this action. Please try again.", "error");
  }
}
