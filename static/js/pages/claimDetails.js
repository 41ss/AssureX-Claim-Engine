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
import { formatDate, formatPercent, formatFileSize } from "../utils/formatters.js";
import { getQueryParam } from "../utils/helpers.js";
import { showToast } from "../components/toast.js";

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
        <p class="text-sm">${claim.product.name} — ${claim.faultType} · submitted ${formatDate(claim.submittedAt)}</p>
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
        <div class="card" style="margin-bottom:var(--space-4)">
          <div class="card__header"><div class="card__title">Claim Information</div></div>
          <dl>
            <div class="detail-row"><dt>Product</dt><dd>${claim.product.name}</dd></div>
            <div class="detail-row"><dt>Brand / Model</dt><dd>${claim.product.brand} ${claim.product.model}</dd></div>
            <div class="detail-row"><dt>Serial number</dt><dd>${claim.product.serialNumber}</dd></div>
            <div class="detail-row"><dt>Fault type</dt><dd>${claim.faultType}</dd></div>
            <div class="detail-row"><dt>Incident date</dt><dd>${formatDate(claim.incidentDate)}</dd></div>
            <div class="detail-row"><dt>Warranty</dt><dd>${claim.warranty.provider} — ${claim.warranty.active ? statusBadge("active") : statusBadge("expired")}</dd></div>
          </dl>
          <p style="margin-top:var(--space-4)">${claim.description}</p>
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
          <div class="card__header"><div class="card__title">${icon("sparkles", { size: 16 })} AI Analysis</div></div>
          ${modelCard(claim.analysis.modelOne)}
          <div class="model-vs">vs</div>
          ${modelCard(claim.analysis.modelTwo)}
          <div class="detail-row" style="margin-top:var(--space-3)"><dt>Consistency</dt><dd>${claim.analysis.consistency}</dd></div>
          <div class="detail-row"><dt>Confidence difference</dt><dd>${formatPercent(claim.analysis.confidenceDifference)}</dd></div>
        </div>

        <div class="card">
          <div class="card__header"><div class="card__title">Decision</div></div>
          <h3 style="margin-bottom:var(--space-2)">${claim.decision.result}</h3>
          <p style="margin-bottom:var(--space-4)">${claim.decision.explanation}</p>
          ${claim.decision.supportingFactors.map((f) => `<div class="check-item is-done">${icon("check-circle-2", { size: 16 })}${f}</div>`).join("")}
          ${claim.decision.opposingFactors.map((f) => `<div class="check-item is-pending">${icon("x-circle", { size: 16 })}${f}</div>`).join("")}
        </div>
      </div>
    </div>

    <div id="tab-documents" class="card" style="display:none">
      <div class="card__header"><div class="card__title">Documents</div></div>
      ${claim.documents.length
        ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:var(--space-3)">
            ${claim.documents.map((d) => `
              <div>
                <div class="evidence-thumb">${icon("file-text", { size: 24 })}</div>
                <div class="text-xs" style="margin-top:6px;font-weight:600">${d.name}</div>
                <div class="text-xs text-muted">${d.type} · ${formatFileSize(d.size)}</div>
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

function modelCard(model) {
  return `
    <div class="model-card">
      <div class="model-card__head">
        <strong class="text-sm">${model.name}</strong>
        <span class="text-xs text-muted">${model.version}</span>
      </div>
      <div class="text-sm" style="margin-bottom:6px">Prediction: <strong>${model.prediction}</strong></div>
      <div class="text-xs text-muted">Valid ${formatPercent(model.confidence.valid)} · Invalid ${formatPercent(model.confidence.invalid)} · Review ${formatPercent(model.confidence.review)}</div>
    </div>`;
}

function contradictionsBlock(claim) {
  return `
    <div class="card contradiction-card alert--danger" style="margin-bottom:var(--space-4);border:1px solid var(--status-rejected-border)">
      <div style="display:flex;gap:var(--space-3);align-items:flex-start">
        ${icon("alert-triangle", { size: 18 })}
        <div>
          <div class="alert__title">Attention — contradiction detected</div>
          ${claim.decision.contradictions.map((c) => `<p class="text-sm">${c.field}: ${c.detail}</p>`).join("")}
        </div>
      </div>
    </div>`;
}

function missingDocsBlock(claim) {
  return `
    <div class="card missing-doc-card" style="margin-bottom:var(--space-4);border:1px solid var(--status-warning-border);background:var(--status-warning-bg)">
      <div class="card__header"><div class="card__title" style="color:var(--status-warning-fg)">Documents Required</div></div>
      ${claim.decision.missingDocuments.map((d) => `<div class="check-item is-pending">${icon("x-circle", { size: 16 })}${d}</div>`).join("")}
      <a class="btn btn-primary btn-sm" style="margin-top:var(--space-3)" href="/new-claim">${icon("upload", { size: 14 })}Upload Missing Document</a>
    </div>`;
}

function duplicateBlock(claim) {
  const d = claim.decision.duplicateWarning;
  return `
    <div class="card duplicate-card" style="margin-bottom:var(--space-4);border:1px solid var(--status-review-border);background:var(--status-review-bg)">
      <div class="card__header"><div class="card__title" style="color:var(--status-review-fg)">Duplicate Possible</div></div>
      <p class="text-sm">This claim appears similar to an existing claim.</p>
      <div class="detail-row"><dt>Related claim</dt><dd><a href="/claim-details?id=${d.relatedClaimId}" style="color:var(--text-link);font-weight:600">${d.relatedClaimId}</a></dd></div>
      <div class="detail-row"><dt>Date</dt><dd>${formatDate(d.relatedDate)}</dd></div>
      <div class="detail-row"><dt>Status</dt><dd>${d.relatedStatus}</dd></div>
    </div>`;
}

function wire(claim) {
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
