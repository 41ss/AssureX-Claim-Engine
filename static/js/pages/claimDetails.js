/**
 * pages/claimDetails.js — /claims/:id equivalent (query-param based).
 * Shows product info, documents, AI analysis, decision, contradictions,
 * missing documents, duplicate warnings, timeline, and report download.
 */
import { claimService } from "../services/claimService.js";
import { reportService } from "../services/reportService.js";
import { icon } from "../components/icons.js";
import { statusBadge } from "../components/statusBadge.js";
import { skeletonLines } from "../components/loadingState.js";
import { errorState, friendlyError } from "../components/errorState.js";
import { formatDate, formatFileSize } from "../utils/formatters.js";
import { getQueryParam } from "../utils/helpers.js";
import { showToast } from "../components/toast.js";
import { modelComparisonCard, rulesCard, summaryCardImage } from "../components/analysisBlocks.js";
import { mountUploader } from "../components/fileUpload.js";
import { escapeHtml } from "../utils/helpers.js";
import { categoryLabel, docTypeLabel } from "../utils/claimOptions.js";

export async function renderClaimDetailsPage(container) {
  const id = getQueryParam("id");
  container.innerHTML = `<div class="card">${skeletonLines(6)}</div>`;

  if (!id) {
    container.innerHTML = errorState({ title: "No claim specified", body: "Go back to Claims and select one to view." });
    return;
  }

  try {
    const claim = await claimService.getClaim(id);
    if (!claim) {
      container.innerHTML = errorState({ title: "Claim not found", body: `We couldn't find ${id}.` });
      return;
    }
    container.innerHTML = buildPage(claim);
    wire(claim);
  } catch (err) {
    container.innerHTML = errorState({ body: friendlyError(err), onRetry: () => renderClaimDetailsPage(container) });
  }
}

function buildPage(claim) {
  return `
    <div class="page-header">
      <div>
        <a href="/claims" class="btn btn-ghost btn-sm" style="margin-bottom:var(--space-2)">${icon("arrow-left", { size: 14 })}Back to Claims</a>
        <div style="display:flex;align-items:center;gap:var(--space-3)">
          <h2>${claim.id}</h2>${statusBadge(claim.status)}
        </div>
        <p class="text-sm">${escapeHtml(claim.product.name)} — ${escapeHtml(claim.faultType)} · ${escapeHtml(claim.stage)}${claim.submittedAt ? ` · submitted ${formatDate(claim.submittedAt)}` : ""}</p>
      </div>
      <div class="page-header__actions">
        <button class="btn btn-secondary" id="download-report">${icon("download", { size: 15 })}Download Report</button>
      </div>
    </div>

    <div class="tabs">
      <button class="tab is-active" data-tab="overview">Overview</button>
      <button class="tab" data-tab="documents">Documents</button>
      <button class="tab" data-tab="activity">Activity Log</button>
    </div>

    <div id="tab-overview" class="claim-detail-grid">
      <div>
        ${resubmitBlock(claim)}
        <div class="card" style="margin-bottom:var(--space-4)">
          <div class="card__header"><div class="card__title">Claim Information</div></div>
          <dl>
            <div class="detail-row"><dt>Product</dt><dd>${escapeHtml(claim.product.name)} (${claim.product.id})</dd></div>
            <div class="detail-row"><dt>Category</dt><dd>${categoryLabel(claim.product.category)}</dd></div>
            <div class="detail-row"><dt>Brand / Model</dt><dd>${escapeHtml(claim.product.brand)} ${escapeHtml(claim.product.model)}</dd></div>
            <div class="detail-row"><dt>Serial number</dt><dd>${escapeHtml(claim.product.serialNumber)}${claim.serialNumber && claim.serialNumber !== claim.product.serialNumber ? ` <span class="badge badge--warning">claim says ${escapeHtml(claim.serialNumber)}</span>` : ""}</dd></div>
            <div class="detail-row"><dt>Fault</dt><dd>${escapeHtml(claim.faultType)}</dd></div>
            <div class="detail-row"><dt>Damage</dt><dd>${escapeHtml(claim.damageLabel || "—")}</dd></div>
            <div class="detail-row"><dt>Fault date</dt><dd>${formatDate(claim.incidentDate)}</dd></div>
            <div class="detail-row"><dt>Previous repairs</dt><dd>${claim.repairCount ?? 0}${claim.unauthorizedRepairs ? ` (${claim.unauthorizedRepairs} unauthorised)` : ""}</dd></div>
            <div class="detail-row"><dt>Warranty</dt><dd class="detail-row__stack">${statusBadge(claim.warranty.status || (claim.warranty.active ? "active" : "expired"))}<span>${escapeHtml(claim.warranty.provider)} · until ${formatDate(claim.warranty.expiry)}</span></dd></div>
          </dl>
          <p style="margin-top:var(--space-4)">${escapeHtml(claim.description)}</p>
        </div>

        ${claim.decision.contradictions.length ? contradictionsBlock(claim) : ""}
        ${claim.decision.missingDocuments.length ? missingDocsBlock(claim) : ""}
        ${claim.decision.duplicateWarning ? duplicateBlock(claim) : ""}

        <div class="card">
          <div class="card__header"><div class="card__title">Claim Timeline</div></div>
          <div class="timeline">
            ${claim.timeline.map((t) => `
              <div class="timeline__item ${t.complete ? "is-complete" : t.current ? "is-current" : ""}">
                <div class="timeline__dot"></div>
                <div class="timeline__title">${t.label}</div>
                ${t.timestamp ? `<div class="timeline__meta">${formatDate(t.timestamp)} · ${new Date(t.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</div>` : ""}
              </div>`).join("")}
          </div>
        </div>
      </div>

      <div>
        <div class="card" style="margin-bottom:var(--space-4)">
          <div class="card__header"><div class="card__title">Decision</div></div>
          <h3 style="margin-bottom:var(--space-2)">${escapeHtml(claim.decision.result || "Not evaluated yet")}</h3>
          <p style="margin-bottom:var(--space-4)">${escapeHtml(claim.decision.explanation || "")}</p>
          ${claim.decision.supportingFactors.length ? `<div class="card__subtitle">Supporting the decision</div>` : ""}
          ${claim.decision.supportingFactors.map((f) => `<div class="check-item is-done">${icon("check-circle-2", { size: 16 })}${escapeHtml(f)}</div>`).join("")}
          ${claim.decision.opposingFactors.length ? `<div class="card__subtitle" style="margin-top:var(--space-2)">Against the decision</div>` : ""}
          ${claim.decision.opposingFactors.map((f) => `<div class="check-item is-pending">${icon("x-circle", { size: 16 })}${escapeHtml(f)}</div>`).join("")}
          ${claim.reviews?.length ? `<div class="card__subtitle" style="margin-top:var(--space-3)">Reviewer notes</div>${claim.reviews.map((r) => `<p class="text-sm"><strong>${escapeHtml(r.reviewer)}</strong> · ${escapeHtml(r.action)} · ${formatDate(r.timestamp)}${r.comment ? `<br>${escapeHtml(r.comment)}` : ""}</p>`).join("")}` : ""}
        </div>
        ${modelComparisonCard(claim.analysis)}
        ${rulesCard(claim.decision)}
        ${summaryCardImage(claim.analysis)}
      </div>
    </div>

    <div id="tab-documents" class="card" style="display:none">
      <div class="card__header"><div class="card__title">Documents</div></div>
      ${claim.documents.length
        ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:var(--space-3)">
            ${claim.documents.map((d) => `
              <div>
                <a class="evidence-thumb" href="${claimService.documentUrl(claim.id, d.id)}" target="_blank" rel="noopener">${icon("file-text", { size: 24 })}</a>
                <div class="text-xs" style="margin-top:6px;font-weight:600">${escapeHtml(d.name)}</div>
                <div class="text-xs text-muted">${docTypeLabel(d.type)} · ${formatFileSize(d.size)}</div>
                ${d.duplicateOf ? `<div class="text-xs" style="color:var(--status-warning-fg)">Also used on ${escapeHtml(d.duplicateOf)}</div>` : ""}
              </div>`).join("")}
          </div>`
        : `<p>No documents uploaded.</p>`}
    </div>

    <div id="tab-activity" class="card" style="display:none">
      <div class="card__header"><div class="card__title">Activity Log</div></div>
      <div class="timeline">
        ${claim.timeline.map((t) => `
          <div class="timeline__item ${t.complete ? "is-complete" : t.current ? "is-current" : ""}">
            <div class="timeline__dot"></div>
            <div class="timeline__title">${t.label}</div>
            ${t.timestamp ? `<div class="timeline__meta">${formatDate(t.timestamp)}</div>` : ""}
          </div>`).join("")}
      </div>
    </div>
  `;
}

function contradictionsBlock(claim) {
  return `
    <div class="card contradiction-card alert--danger" style="margin-bottom:var(--space-4);border:1px solid var(--status-rejected-border)">
      <div style="display:flex;gap:var(--space-3);align-items:flex-start">
        ${icon("alert-triangle", { size: 18 })}
        <div>
          <div class="alert__title">Attention — contradiction detected</div>
          ${claim.decision.contradictions.map((c) => `<p class="text-sm">${escapeHtml(c)}</p>`).join("")}
        </div>
      </div>
    </div>`;
}

function missingDocsBlock(claim) {
  return `
    <div class="card missing-doc-card" style="margin-bottom:var(--space-4);border:1px solid var(--status-warning-border);background:var(--status-warning-bg)">
      <div class="card__header"><div class="card__title" style="color:var(--status-warning-fg)">Documents Required</div></div>
      ${claim.decision.missingDocuments.map((d) => `<div class="check-item is-pending">${icon("x-circle", { size: 16 })}${escapeHtml(d)}</div>`).join("")}
    </div>`;
}

function duplicateBlock(claim) {
  const d = claim.decision.duplicateWarning;
  return `
    <div class="card duplicate-card" style="margin-bottom:var(--space-4);border:1px solid var(--status-review-border);background:var(--status-review-bg)">
      <div class="card__header"><div class="card__title" style="color:var(--status-review-fg)">Duplicate Possible</div></div>
      <p class="text-sm">${escapeHtml(d.reason || "This claim appears similar to an existing claim.")}</p>
      <div class="detail-row"><dt>Related claim</dt><dd><a href="/claim-details?id=${d.relatedClaimId}" style="color:var(--text-link);font-weight:600">${d.relatedClaimId}</a></dd></div>
      <div class="detail-row"><dt>Date</dt><dd>${formatDate(d.relatedDate)}</dd></div>
      <div class="detail-row"><dt>Status</dt><dd>${d.relatedStatus}</dd></div>
    </div>`;
}

/** Draft or "Additional Information Required": upload more documents and resubmit. */
function resubmitBlock(claim) {
  if (claim.status !== "draft" && claim.status !== "info") return "";
  const types = claim.requiredDocumentTypes?.length ? claim.requiredDocumentTypes : ["fault_evidence"];
  return `
    <div class="card" style="margin-bottom:var(--space-4);border:1px solid var(--status-warning-border)">
      <div class="card__header"><div><div class="card__title">${claim.status === "info" ? "More information requested" : "This claim is still a draft"}</div>
        <div class="card__subtitle">Upload the documents below, then submit the claim for evaluation.</div></div></div>
      ${types.map((t) => `<div style="margin-bottom:var(--space-4)"><div class="field__label" style="margin-bottom:var(--space-2)">${docTypeLabel(t)}</div><div data-resubmit-uploader="${t}"></div></div>`).join("")}
      <button class="btn btn-primary" id="resubmit-claim" type="button">${icon("check-circle-2", { size: 15 })}Submit for evaluation</button>
    </div>`;
}

function wire(claim) {
  document.querySelectorAll("[data-resubmit-uploader]").forEach((el) => {
    const type = el.dataset.resubmitUploader;
    mountUploader(el, { claimId: claim.id, docType: type, docLabel: docTypeLabel(type), video: type === "fault_video" || type === "fault_evidence" });
  });
  document.getElementById("resubmit-claim")?.addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    try {
      await claimService.submitClaim(claim.id);
      showToast("Claim submitted for evaluation.", "success");
      renderClaimDetailsPage(document.getElementById("page-content"));
    } catch (err) {
      document.getElementById("resubmit-claim").disabled = false;
      showToast(err.message, "error");
    }
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      ["overview", "documents", "activity"].forEach((name) => {
        document.getElementById(`tab-${name}`).style.display = name === tab.dataset.tab ? "" : "none";
      });
    });
  });

  document.getElementById("download-report").addEventListener("click", async () => {
    try {
      await reportService.downloadClaimReport(claim.id);
      showToast("Report download started.", "success");
    } catch (err) {
      showToast("We couldn't generate this report. Please try again.", "error");
    }
  });
}
