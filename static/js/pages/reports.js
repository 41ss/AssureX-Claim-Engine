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

    <div class="card">
      <div class="card__header"><div class="card__title">Available Reports</div></div>
      <div id="reports-list"></div>
    </div>
  `;

  loadStats();
  loadCharts();
  loadModelPerformance();
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
          <div class="recent-claim__title">${r.title}</div>
          <div class="recent-claim__sub">${r.period} · generated ${formatDate(r.generatedAt)}</div>
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

function downloadReport(report) {
  if (!report) return;
  const csv = [
    ["Report ID", "Title", "Period", "Generated"],
    [report.id, report.title, report.period, formatDate(report.generatedAt)],
    [],
    ["Note", "This demonstration export is generated in the browser. The production backend will provide the complete report file."],
  ].map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${report.id}-${report.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Report download started.", "success");
}
