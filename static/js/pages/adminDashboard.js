/**
 * pages/adminDashboard.js — administrative overview: totals, review
 * queue size, duplicate/model-disagreement alerts, and trend charts.
 */
import { dashboardService } from "../services/dashboardService.js";
import { adminService } from "../services/adminService.js";
import { icon } from "../components/icons.js";
import { claimTableRow } from "../components/claimCard.js";
import { multiSeriesAreaChart } from "../components/chart.js";
import { skeletonCards, skeletonLines, skeletonTableRows } from "../components/loadingState.js";
import { errorState, friendlyError } from "../components/errorState.js";
import { emptyState } from "../components/emptyState.js";
import { showToast } from "../components/toast.js";
import { claimService } from "../services/claimService.js";
import { productService } from "../services/productService.js";

export async function renderAdminDashboardPage(container, session) {
  container.innerHTML = `
    <div class="page-header">
      <div><h2>Admin Dashboard</h2><p class="text-sm">System-wide claim activity and model health, ${session.name.split(" ")[0]}.</p></div>
      <div class="page-header__actions"><select class="select" id="admin-export-type" aria-label="Export data"><option value="review-queue">Review Queue</option><option value="claims">All Claims</option><option value="products">Products & Warranties</option><option value="analytics">Analytics</option></select><button class="btn btn-secondary" type="button" id="export-admin-csv">${icon("download", { size: 16 })}Export CSV</button><a href="/admin-review" class="btn btn-primary">${icon("shield-check", { size: 16 })}Review Queue</a></div>
    </div>

    <div class="stat-grid" id="admin-stat-grid">${skeletonCards(7)}</div>

    <div class="dash-grid" style="grid-template-columns:1.6fr 1fr">
      <div class="card">
        <div class="card__header"><div class="card__title">Claim Volume</div></div>
        <div class="chart-legend" style="margin-bottom:var(--space-3)">
          <span class="chart-legend__item"><span class="chart-legend__dot" style="background:#145C4A"></span>Approved</span>
          <span class="chart-legend__item"><span class="chart-legend__dot" style="background:#C4694E"></span>Rejected</span>
          <span class="chart-legend__item"><span class="chart-legend__dot" style="background:#8C7FD1"></span>Under Review</span>
        </div>
        <div id="admin-chart">${skeletonLines(1, ["100%"])}</div>
      </div>
      <div class="card">
        <div class="card__header"><div class="card__title">System Alerts</div></div>
        <div id="alerts-list">${skeletonLines(3)}</div>
      </div>
    </div>

    <div class="card">
      <div class="card__header">
        <div class="card__title">Claims Awaiting Review</div>
        <a href="/admin-review" style="font-size:var(--fs-xs);font-weight:600;color:var(--text-link)">Open full queue</a>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Claim</th><th>Fault</th><th>Status</th><th>Warranty</th><th>Submitted</th><th></th></tr></thead>
          <tbody id="admin-queue-tbody">${skeletonTableRows(4, 6)}</tbody>
        </table>
      </div>
    </div>
  `;

  loadStats();
  loadChart();
  loadQueue();
  document.getElementById("export-admin-csv").addEventListener("click", exportAdminQueue);
}

async function exportAdminQueue() {
  try {
    const type = document.getElementById("admin-export-type").value;
    let rows;
    let filename;
    if (type === "products") {
      const products = await productService.getProducts();
      rows = [["Product ID", "Product", "Category", "Brand", "Model", "Serial", "Warranty", "Expiry"], ...products.map((product) => [product.id, product.name, product.type, product.brand, product.model, product.serialNumber, product.warranty.provider, product.warranty.expiry])];
      filename = "assurex-products-warranties.csv";
    } else if (type === "analytics") {
      const stats = await dashboardService.getAdminStats();
      rows = [["Metric", "Value"], ["Total Claims", stats.totalClaims.value], ["Valid Claims", stats.validClaims], ["Invalid Claims", stats.invalidClaims], ["Manual Review Claims", stats.manualReviewClaims], ["Average Confidence", `${Math.round(stats.averageConfidence * 100)}%`], ["Model Disagreements", stats.modelDisagreements.value], ["Duplicate Alerts", stats.duplicateAlerts.value]];
      filename = "assurex-analytics.csv";
    } else {
      const claims = type === "claims" ? await claimService.getClaims() : await adminService.getReviewQueue();
      rows = [["Claim ID", "Product", "Fault", "Status", "Warranty", "Submitted"], ...claims.map((claim) => [claim.id, claim.product.name, claim.faultType, claim.status, claim.warranty.active ? "Active" : "Expired", claim.submittedAt])];
      filename = type === "claims" ? "assurex-claims.csv" : "assurex-review-queue.csv";
    }
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    showToast("We couldn't export the review queue.", "error");
  }
}

async function loadStats() {
  const slot = document.getElementById("admin-stat-grid");
  try {
    const stats = await dashboardService.getAdminStats();
    slot.innerHTML = `
      <div class="stat-card"><div class="stat-card__icon stat-card__icon--forest">${icon("file-text", { size: 20 })}</div>
        <div><div class="stat-card__label">Total Claims</div><div class="stat-card__value font-numeric">${stats.totalClaims.value}</div><div class="stat-card__delta is-up">+${stats.totalClaims.deltaPct}% vs last 7 days</div></div></div>
      <div class="stat-card"><div class="stat-card__icon stat-card__icon--approved">${icon("check-circle-2", { size: 20 })}</div>
        <div><div class="stat-card__label">Valid Claims</div><div class="stat-card__value font-numeric">${stats.validClaims}</div></div></div>
      <div class="stat-card"><div class="stat-card__icon stat-card__icon--rejected">${icon("x-circle", { size: 20 })}</div>
        <div><div class="stat-card__label">Invalid Claims</div><div class="stat-card__value font-numeric">${stats.invalidClaims}</div></div></div>
      <div class="stat-card"><div class="stat-card__icon stat-card__icon--review">${icon("clock-3", { size: 20 })}</div>
        <div><div class="stat-card__label">Manual Review</div><div class="stat-card__value font-numeric">${stats.manualReviewClaims}</div></div></div>
      <div class="stat-card"><div class="stat-card__icon stat-card__icon--review">${icon("clock-3", { size: 20 })}</div>
        <div><div class="stat-card__label">Pending Review</div><div class="stat-card__value font-numeric">${stats.pendingReview.value}</div><div class="stat-card__delta is-up">+${stats.pendingReview.deltaPct}% vs last 7 days</div></div></div>
      <div class="stat-card"><div class="stat-card__icon stat-card__icon--rejected">${icon("alert-triangle", { size: 20 })}</div>
        <div><div class="stat-card__label">Model Disagreements</div><div class="stat-card__value font-numeric">${stats.modelDisagreements.value}</div><div class="stat-card__delta is-down">${stats.modelDisagreements.deltaPct}% vs last 7 days</div></div></div>
      <div class="stat-card"><div class="stat-card__icon stat-card__icon--approved">${icon("scan-search", { size: 20 })}</div>
        <div><div class="stat-card__label">Duplicate Alerts</div><div class="stat-card__value font-numeric">${stats.duplicateAlerts.value}</div><div class="stat-card__delta is-up">+${stats.duplicateAlerts.deltaPct}% vs last 7 days</div></div></div>`;
      slot.innerHTML += `<div class="stat-card"><div class="stat-card__icon stat-card__icon--forest">${icon("badge-check", { size: 20 })}</div><div><div class="stat-card__label">Average Confidence</div><div class="stat-card__value font-numeric">${Math.round(stats.averageConfidence * 100)}%</div></div></div>`;

    document.getElementById("alerts-list").innerHTML = `
      <div class="check-item is-pending">${icon("alert-triangle", { size: 16 })}${stats.modelDisagreements.value} claims with model disagreement</div>
      <div class="check-item is-pending">${icon("scan-search", { size: 16 })}${stats.duplicateAlerts.value} possible duplicate claims</div>
      <div class="check-item is-done">${icon("check-circle-2", { size: 16 })}No failed uploads in the last 24h</div>
      <div class="check-item is-done">${icon("check-circle-2", { size: 16 })}Both models responding normally</div>`;
  } catch (err) {
    slot.innerHTML = errorState({ body: friendlyError(err), onRetry: loadStats });
  }
}

async function loadChart() {
  const slot = document.getElementById("admin-chart");
  try {
    const trend = await dashboardService.getClaimsTrend("7d");
    slot.innerHTML = multiSeriesAreaChart({
      labels: trend.labels,
      series: [
        { key: "approved", values: trend.approved },
        { key: "rejected", values: trend.rejected },
        { key: "review", values: trend.review },
      ],
    });
  } catch (err) {
    slot.innerHTML = errorState({ body: friendlyError(err), onRetry: loadChart });
  }
}

async function loadQueue() {
  const tbody = document.getElementById("admin-queue-tbody");
  try {
    const queue = await adminService.getReviewQueue();
    tbody.innerHTML = queue.length
      ? queue.slice(0, 4).map((c) => claimTableRow(c)).join("")
      : `<tr><td colspan="6">${emptyState({ title: "Queue is empty", body: "Nothing needs manual review right now." })}</td></tr>`;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6">${errorState({ body: friendlyError(err), onRetry: loadQueue })}</td></tr>`;
  }
}
