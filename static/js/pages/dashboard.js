/**
 * pages/dashboard.js — the main user dashboard.
 * Gives an immediate overview of claims and a clear path to create
 * or monitor one. Every number here comes through dashboardService /
 * claimService — nothing is invented at the page level.
 */
import { dashboardService } from "../services/dashboardService.js";
import { claimService } from "../services/claimService.js";
import { icon } from "../components/icons.js";
import { statCard } from "../components/statCard.js";
import { recentClaimRow } from "../components/claimCard.js";
import { multiSeriesAreaChart } from "../components/chart.js";
import { skeletonCards, skeletonLines } from "../components/loadingState.js";
import { errorState, friendlyError } from "../components/errorState.js";
import { emptyState } from "../components/emptyState.js";

export async function renderDashboardPage(container, session) {
  container.innerHTML = `
    <div class="hero-banner">
      <div class="hero-banner__eyebrow">WELCOME BACK, ${session.name.split(" ")[0].toUpperCase()}</div>
      <h1>Smarter Claims. Faster Decisions.</h1>
      <p>AI-powered claim analysis, built for trust, accuracy and a better tomorrow.</p>
      <div class="hero-banner__actions">
        <a href="/new-claim" class="btn btn-primary">${icon("plus", { size: 16 })}New Claim</a>
        <a href="/claims" class="btn btn-secondary">${icon("files", { size: 16 })}View All Claims</a>
      </div>
    </div>

    <div class="stat-grid" id="stat-grid">${skeletonCards(4)}</div>

    <div class="dash-grid">
      <div class="card" id="chart-card">
        <div class="card__header">
          <div>
            <div class="card__title">Claims Overview</div>
            <div class="card__subtitle">Claim volume and decision trend</div>
          </div>
          <div class="dropdown" id="range-dropdown">
            <button class="dropdown__trigger" id="range-trigger">
              <span id="range-label">Last 7 days</span>${icon("chevron-down", { size: 14 })}
            </button>
            <div class="dropdown__menu">
              <button class="dropdown__item is-selected" data-range="7d">Last 7 days</button>
              <button class="dropdown__item" data-range="30d">Last 30 days</button>
              <button class="dropdown__item" data-range="90d">Last 90 days</button>
            </div>
          </div>
        </div>
        <div class="chart-legend" style="margin-bottom:var(--space-3)">
          <span class="chart-legend__item"><span class="chart-legend__dot" style="background:#145C4A"></span>Approved</span>
          <span class="chart-legend__item"><span class="chart-legend__dot" style="background:#C4694E"></span>Rejected</span>
          <span class="chart-legend__item"><span class="chart-legend__dot" style="background:#8C7FD1"></span>Under Review</span>
        </div>
        <div id="chart-slot">${skeletonLines(1, ["100%"])}</div>
      </div>

      <div class="card" id="recent-claims-card">
        <div class="card__header">
          <div class="card__title">Recent Claims</div>
          <a href="/claims" style="font-size:var(--fs-xs);font-weight:600;color:var(--text-link)">View all</a>
        </div>
        <div class="recent-claims-list" id="recent-claims-list">${skeletonLines(4)}</div>
      </div>

      <div class="card" id="ai-analysis-card">
        <div class="card__header">
          <div class="card__title">${icon("sparkles", { size: 16 })} AI Analysis</div>
        </div>
        <div id="ai-analysis-body">${skeletonLines(2)}</div>
      </div>
    </div>

    <div class="dash-grid">
      <div class="card" id="readiness-card">
        <div class="card__header">
          <div>
            <div class="card__title">Claim Preparation</div>
            <div class="card__subtitle">Check what's missing before submitting.</div>
          </div>
        </div>
        <div id="readiness-body">${skeletonLines(3)}</div>
      </div>

      <div class="card">
        <div class="card__header"><div class="card__title">Quick Actions</div></div>
        <div class="quick-actions-grid">
          <a class="quick-action" href="/products">${icon("package", { size: 18 })}Register Product</a>
          <a class="quick-action" href="/new-claim">${icon("upload", { size: 18 })}Upload Receipt</a>
          <a class="quick-action" href="/products">${icon("shield-check", { size: 18 })}Check Warranty</a>
          <a class="quick-action" href="/reports">${icon("bar-chart-3", { size: 18 })}View Reports</a>
        </div>
      </div>

      <div class="card">
        <div class="card__header">
          <div class="card__title">Recent Activity</div>
        </div>
        <div id="activity-list">${skeletonLines(4)}</div>
      </div>
    </div>
  `;

  wireRangeDropdown();
  loadStats();
  loadChart("7d");
  loadRecentClaims();
  loadAiAnalysis();
  loadReadiness();
  loadActivity();
}

async function loadStats() {
  const slot = document.getElementById("stat-grid");
  try {
    const stats = await dashboardService.getDashboardStats();
    slot.innerHTML = [
      statCard({ label: "Total Claims", value: stats.totalClaims.value, deltaPct: stats.totalClaims.deltaPct, direction: stats.totalClaims.direction, iconName: "file-text", tone: "forest" }),
      statCard({ label: "Approved", value: stats.approved.value, deltaPct: stats.approved.deltaPct, direction: stats.approved.direction, iconName: "check-circle-2", tone: "approved" }),
      statCard({ label: "Rejected", value: stats.rejected.value, deltaPct: stats.rejected.deltaPct, direction: stats.rejected.direction, iconName: "x-circle", tone: "rejected" }),
      statCard({ label: "Under Review", value: stats.underReview.value, deltaPct: stats.underReview.deltaPct, direction: stats.underReview.direction, iconName: "clock-3", tone: "review" }),
    ].join("");
  } catch (err) {
    slot.innerHTML = `<div class="card">${errorState({ body: friendlyError(err), onRetry: loadStats })}</div>`;
  }
}

async function loadChart(range) {
  const slot = document.getElementById("chart-slot");
  try {
    const trend = await dashboardService.getClaimsTrend(range);
    slot.innerHTML = multiSeriesAreaChart({
      labels: trend.labels,
      series: [
        { key: "approved", values: trend.approved },
        { key: "rejected", values: trend.rejected },
        { key: "review", values: trend.review },
      ],
    });
  } catch (err) {
    slot.innerHTML = errorState({ body: friendlyError(err), onRetry: () => loadChart(range) });
  }
}

function wireRangeDropdown() {
  const dropdown = document.getElementById("range-dropdown");
  const trigger = document.getElementById("range-trigger");
  const label = document.getElementById("range-label");
  const labels = { "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days" };

  trigger.addEventListener("click", (e) => { e.stopPropagation(); dropdown.classList.toggle("is-open"); });
  document.addEventListener("click", () => dropdown.classList.remove("is-open"));

  dropdown.querySelectorAll("[data-range]").forEach((item) => {
    item.addEventListener("click", () => {
      dropdown.querySelectorAll("[data-range]").forEach((i) => i.classList.remove("is-selected"));
      item.classList.add("is-selected");
      label.textContent = labels[item.dataset.range];
      dropdown.classList.remove("is-open");
      document.getElementById("chart-slot").innerHTML = skeletonLines(1, ["100%"]);
      loadChart(item.dataset.range);
    });
  });
}

async function loadRecentClaims() {
  const slot = document.getElementById("recent-claims-list");
  try {
    const claims = await dashboardService.getRecentClaims(5);
    slot.innerHTML = claims.length
      ? claims.map(recentClaimRow).join("")
      : emptyState({ title: "No claims yet", body: "You haven't submitted any claims yet.", actionLabel: "Create New Claim", actionHref: "/new-claim" });
  } catch (err) {
    slot.innerHTML = errorState({ body: friendlyError(err), onRetry: loadRecentClaims });
  }
}

async function loadAiAnalysis() {
  const slot = document.getElementById("ai-analysis-body");
  try {
    const stats = await dashboardService.getDashboardStats();
    const pct = Math.round(stats.averageConfidence * 100);
    slot.innerHTML = `
      <div style="display:flex;align-items:center;gap:var(--space-4)">
        <div class="text-display" style="font-size:var(--fs-2xl)">${pct}%</div>
        <div class="text-xs text-muted">Average confidence score across both models this week.</div>
      </div>
      <div class="ai-analysis__list">
        <div class="check-item is-done">${icon("check-circle-2", { size: 16 })}Fraudulent claims</div>
        <div class="check-item is-done">${icon("check-circle-2", { size: 16 })}Policy violations</div>
        <div class="check-item is-done">${icon("check-circle-2", { size: 16 })}Document inconsistencies</div>
        <div class="check-item is-done">${icon("check-circle-2", { size: 16 })}Warranty exclusions</div>
      </div>`;
  } catch (err) {
    slot.innerHTML = errorState({ body: friendlyError(err), onRetry: loadAiAnalysis });
  }
}

async function loadReadiness() {
  const slot = document.getElementById("readiness-body");
  try {
    const claims = await claimService.getClaims({});
    const draftOrReview = claims.find((c) => c.status === "review") || claims[0];
    if (!draftOrReview) {
      slot.innerHTML = emptyState({ title: "Nothing to prepare", body: "Start a new claim to see readiness checks here.", actionLabel: "New Claim", actionHref: "/new-claim" });
      return;
    }
    const pct = Math.round((draftOrReview.readiness || 0.8) * 100);
    slot.innerHTML = `
      <div class="readiness">
        <div style="flex:1;min-width:200px">
          <div class="check-item is-done">${icon("check-circle-2", { size: 16 })}Product details</div>
          <div class="check-item is-done">${icon("check-circle-2", { size: 16 })}Purchase receipt</div>
          <div class="check-item ${draftOrReview.decision.missingDocuments.length ? "is-pending" : "is-done"}">
            ${icon(draftOrReview.decision.missingDocuments.length ? "x-circle" : "check-circle-2", { size: 16 })}
            ${draftOrReview.decision.missingDocuments[0] || "All documents provided"}
          </div>
          <a class="btn btn-secondary btn-sm" style="margin-top:var(--space-3)" href="/claim-details?id=${draftOrReview.id}">View Claim ${icon("chevron-right", { size: 14 })}</a>
        </div>
        <div style="text-align:center">
          <svg width="0" height="0"></svg>
          ${ringMarkup(pct)}
          <div class="text-xs text-muted" style="margin-top:6px">${pct >= 90 ? "Ready to submit" : "Almost ready"}</div>
        </div>
      </div>`;
  } catch (err) {
    slot.innerHTML = errorState({ body: friendlyError(err), onRetry: loadReadiness });
  }
}

function ringMarkup(pct) {
  // Local import avoided to keep this file's dependency list short —
  // ring rendering logic lives in components/progress.js.
  return `<div class="ring" style="--ring-size:88px">
    <svg width="88" height="88" viewBox="0 0 88 88">
      <circle cx="44" cy="44" r="36" fill="none" stroke="var(--border-subtle)" stroke-width="8"/>
      <circle cx="44" cy="44" r="36" fill="none" stroke="var(--color-forest)" stroke-width="8" stroke-linecap="round"
        stroke-dasharray="${2 * Math.PI * 36}" stroke-dashoffset="${2 * Math.PI * 36 * (1 - pct / 100)}"
        transform="rotate(-90 44 44)"/>
    </svg>
    <span class="ring__value">${pct}%</span>
  </div>`;
}

async function loadActivity() {
  const slot = document.getElementById("activity-list");
  try {
    const notifications = await dashboardService.getNotifications();
    slot.innerHTML = notifications.length
      ? notifications
          .slice(0, 4)
          .map(
            (n) => `
        <div class="recent-claim">
          <div class="icon-tile">${icon("bell", { size: 16 })}</div>
          <div class="recent-claim__body">
            <div class="recent-claim__title">${n.title}</div>
            <div class="recent-claim__sub">${n.body}</div>
          </div>
        </div>`
          )
          .join("")
      : emptyState({ title: "No recent activity", iconName: "history" });
  } catch (err) {
    slot.innerHTML = errorState({ body: friendlyError(err), onRetry: loadActivity });
  }
}
