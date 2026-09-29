/**
 * pages/reports.js — analytics on claim outcomes and model
 * performance, plus a list of generated reports to download.
 */
import { reportService } from "../services/reportService.js";
import { dashboardService } from "../services/dashboardService.js";
import { icon } from "../components/icons.js";
import { simpleDonutChart, simpleBarChart } from "../components/chart.js";
import { skeletonLines } from "../components/loadingState.js";
import { errorState, friendlyError } from "../components/errorState.js";
import { formatPercent, formatDate } from "../utils/formatters.js";
import { showToast } from "../components/toast.js";
import { escapeHtml } from "../utils/helpers.js";
import { download } from "../services/api.js";

export async function renderReportsPage(container) {
  container.innerHTML = `
    <div class="page-header"><div><h2>Reports</h2><p class="text-sm">Claim outcomes, model performance and downloadable reports.</p></div></div>

    <div class="stat-grid stat-grid--three" id="report-stats">${skeletonLines(3)}</div>

    <div class="dash-grid dash-grid--two">
      <div class="card">
        <div class="card__header"><div class="card__title">Claim Outcome</div></div>
        <div id="outcome-chart" style="display:flex;align-items:center;gap:var(--space-6)">${skeletonLines(2)}</div>
      </div>
      <div class="card">
        <div class="card__header"><div class="card__title">Claims by Product Category</div></div>
        <div id="category-chart">${skeletonLines(2)}</div>
      </div>
    </div>

    <div class="card" id="model-performance-card">
      <div class="card__header"><div><div class="card__title">Model Performance & Consistency</div><div class="card__subtitle">Independent model metrics and prediction agreement.</div></div></div>
      <div id="model-performance">${skeletonLines(4)}</div>
    </div>

    <div class="card" style="margin-bottom:var(--space-4)">
      <div class="card__header"><div><div class="card__title">Claim Analytics</div><div class="card__subtitle">Faults, rejection reasons, repairs, warranty expirations and manual-review frequency.</div></div></div>
      <div id="analytics">${skeletonLines(4)}</div>
    </div>

    <div class="card">
      <div class="card__header"><div class="card__title">Available Reports</div></div>
      <div id="reports-list"></div>
    </div>
  `;

  loadStats();
  loadCharts();
  loadModelPerformance();
  loadAnalytics();
  loadReportsList();
}

async function loadStats() {
  const slot = document.getElementById("report-stats");
  try {
    const stats = await dashboardService.getAdminStats();
    slot.innerHTML = `
      <div class="stat-card"><div class="stat-card__icon stat-card__icon--forest">${icon("file-text", { size: 20 })}</div>
        <div><div class="stat-card__label">Total Claims</div><div class="stat-card__value">${stats.totalClaims.value}</div></div></div>
      <div class="stat-card"><div class="stat-card__icon stat-card__icon--approved">${icon("badge-check", { size: 20 })}</div>
        <div><div class="stat-card__label">Approval Rate</div><div class="stat-card__value">${formatPercent(stats.approvalRate)}</div></div></div>
      <div class="stat-card"><div class="stat-card__icon stat-card__icon--review">${icon("clock-3", { size: 20 })}</div>
        <div><div class="stat-card__label">Avg. Processing Time</div><div class="stat-card__value">${stats.avgProcessingDays} days</div></div></div>`;
  } catch (err) {
    slot.innerHTML = errorState({ body: friendlyError(err), onRetry: loadStats });
  }
}

async function loadCharts() {
  const outcomeSlot = document.getElementById("outcome-chart");
  const categorySlot = document.getElementById("category-chart");
  try {
    const [dashStats, byProduct] = await Promise.all([
      dashboardService.getDashboardStats(),
      dashboardService.getClaimsByProduct(),
    ]);
    const values = [dashStats.approved.value, dashStats.rejected.value, dashStats.underReview.value];
    const colors = ["#145C4A", "#C4694E", "#8C7FD1"];
    outcomeSlot.innerHTML = `
      ${simpleDonutChart({ values, colors })}
      <div>
        <div class="chart-legend__item" style="margin-bottom:6px"><span class="chart-legend__dot" style="background:${colors[0]}"></span>Approved — ${formatPercent(values[0] / values.reduce((a,b)=>a+b,0))}</div>
        <div class="chart-legend__item" style="margin-bottom:6px"><span class="chart-legend__dot" style="background:${colors[1]}"></span>Rejected — ${formatPercent(values[1] / values.reduce((a,b)=>a+b,0))}</div>
        <div class="chart-legend__item"><span class="chart-legend__dot" style="background:${colors[2]}"></span>Under Review — ${formatPercent(values[2] / values.reduce((a,b)=>a+b,0))}</div>
      </div>`;
    categorySlot.innerHTML = simpleBarChart({ labels: byProduct.labels, values: byProduct.values });
  } catch (err) {
    outcomeSlot.innerHTML = errorState({ body: friendlyError(err), onRetry: loadCharts });
  }
}

async function loadModelPerformance() {
  const slot = document.getElementById("model-performance");
  try {
    const performance = await reportService.getModelPerformance();
    const rows = [
      ["Accuracy", performance.pythonModel.accuracy, performance.teachableMachine.accuracy],
      ["Precision", performance.pythonModel.precision, performance.teachableMachine.precision],
      ["Recall", performance.pythonModel.recall, performance.teachableMachine.recall],
      ["F1 score", performance.pythonModel.f1, performance.teachableMachine.f1],
    ];
    const consistency = performance.consistencyBreakdown;
    slot.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Metric</th><th>Python model (${performance.pythonModel.version})</th><th>Teachable Machine (${performance.teachableMachine.version})</th></tr></thead>
          <tbody>${rows.map(([label, python, teachable]) => `<tr><td data-label="Metric">${label}</td><td data-label="Python model">${formatPercent(python)}</td><td data-label="Teachable Machine">${formatPercent(teachable)}</td></tr>`).join("")}</tbody>
        </table>
      </div>
      <div class="chart-legend model-consistency-summary">
        <span>Strong ${consistency.strongMatch}%</span><span>Acceptable ${consistency.acceptableMatch}%</span><span>Weak ${consistency.weakMatch}%</span><span>Disagreement ${consistency.modelDisagreement}%</span><span>Uncertain ${consistency.uncertainResult}%</span>
      </div>`;
  } catch (err) {
    slot.innerHTML = errorState({ body: friendlyError(err), onRetry: loadModelPerformance });
  }
}

async function loadReportsList() {
  const slot = document.getElementById("reports-list");
  try {
    const reports = await reportService.getReports();
    slot.innerHTML = reports
      .map(
        (r) => `
      <div class="recent-claim">
        <div class="icon-tile">${icon("file-text", { size: 16 })}</div>
        <div class="recent-claim__body">
          <div class="recent-claim__title">${escapeHtml(r.title)}</div>
          <div class="recent-claim__sub">${escapeHtml(r.description)} · updated ${formatDate(r.generatedAt)}</div>
        </div>
        <button class="btn btn-secondary btn-sm" data-report="${r.id}">${icon("download", { size: 14 })}Download</button>
      </div>`
      )
      .join("");
    slot.querySelectorAll("[data-report]").forEach((btn) =>
      btn.addEventListener("click", () => downloadReport(reports.find((report) => report.id === btn.dataset.report)))
    );
  } catch (err) {
    slot.innerHTML = errorState({ body: friendlyError(err), onRetry: loadReportsList });
  }
}

async function downloadReport(report) {
  if (!report) return;
  try {
    await download(report.url.replace(/^\/api/, ""), report.filename);
    showToast("Report download started.", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

/** Analytics the SRS asks for in xliii, computed by the backend from stored claims. */
async function loadAnalytics() {
  const slot = document.getElementById("analytics");
  try {
    const a = await reportService.getAnalytics();
    const list = (rows) => rows.length
      ? rows.map((r) => `<div class="detail-row"><dt>${escapeHtml(r.label.charAt(0).toUpperCase() + r.label.slice(1))}</dt><dd class="font-numeric">${r.count}</dd></div>`).join("")
      : `<p class="text-sm text-muted">No data yet.</p>`;
    slot.innerHTML = `
      <div class="dash-grid dash-grid--two">
        <div><div class="card__subtitle" style="margin-bottom:var(--space-2)">Most reported faults</div>${list(a.topFaults)}</div>
        <div><div class="card__subtitle" style="margin-bottom:var(--space-2)">Most common rejection reasons</div>${list(a.rejectionReasons)}</div>
        <div><div class="card__subtitle" style="margin-bottom:var(--space-2)">Repair patterns</div>${list(a.repairPatterns)}</div>
        <div><div class="card__subtitle" style="margin-bottom:var(--space-2)">Warranty expirations</div>${list(a.warrantyExpirations)}</div>
      </div>
      <div class="detail-row" style="margin-top:var(--space-3)"><dt>Claims sent to manual review</dt><dd class="font-numeric">${formatPercent(a.manualReviewRate)}</dd></div>`;
  } catch (err) {
    slot.innerHTML = errorState({ body: friendlyError(err), onRetry: loadAnalytics });
  }
}
