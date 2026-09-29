/**
 * pages/claims.js — searchable, filterable, paginated claims list.
 *
 * ADDING A NEW FILTER (the documented live-judging exercise):
 *   1. Add one entry to FILTER_CONFIG below with a key, label and options.
 *   2. Add a matching branch in claimService.getClaims() (js/services/claimService.js)
 *      that narrows `results` when state.filters[key] is set.
 *   That's it — the dropdown, its wiring, and the "clear filters" button
 *   all read FILTER_CONFIG generically, so nothing else needs to change.
 */
import { claimService } from "../services/claimService.js";
import { icon } from "../components/icons.js";
import { claimTableRow } from "../components/claimCard.js";
import { skeletonTableRows } from "../components/loadingState.js";
import { errorState, friendlyError } from "../components/errorState.js";
import { emptyState } from "../components/emptyState.js";
import { debounce } from "../utils/helpers.js";
import { state, resetFilters } from "../state.js";
import { CATEGORIES, CLAIM_STATUSES, CONSISTENCY_STATUSES, isStaff } from "../utils/claimOptions.js";

const FILTER_CONFIG = [
  {
    key: "status",
    label: "Status",
    options: [{ value: "all", label: "All Statuses" }, ...CLAIM_STATUSES],
  },
  {
    key: "category",
    label: "Product category",
    options: [{ value: "all", label: "All Categories" }, ...CATEGORIES.map((c) => ({ value: c.value, label: c.label }))],
  },
  {
    key: "warrantyStatus",
    label: "Warranty",
    options: [
      { value: "all", label: "Any Warranty Status" },
      { value: "active", label: "Active" },
      { value: "expiring", label: "Expiring Soon" },
      { value: "extended", label: "Extended" },
      { value: "expired", label: "Expired" },
    ],
  },
  {
    key: "risk",
    label: "Risk level",
    options: [
      { value: "all", label: "Any Risk Level" },
      { value: "high", label: "High risk" },
      { value: "medium", label: "Medium risk" },
      { value: "low", label: "Low risk" },
    ],
  },
  {
    key: "confidenceRange",
    label: "Confidence",
    options: [
      { value: "all", label: "Any Confidence" },
      { value: "high", label: "High (80%+)" },
      { value: "medium", label: "Medium (60–79%)" },
      { value: "low", label: "Low (below 60%)" },
    ],
  },
  {
    key: "consistency",
    label: "Model Result",
    options: [{ value: "all", label: "All Model Results" }, ...CONSISTENCY_STATUSES.map((c) => ({ value: c, label: c }))],
  },
  {
    key: "reviewer",
    label: "Reviewer",
    staffOnly: true,
    options: [{ value: "all", label: "Any Reviewer" }, { value: "none", label: "Not reviewed yet" }],
    loadOptions: () => claimService.getReviewers(),
  },
];

const PAGE_SIZE = 6;
let currentPage = 1;
let allResults = [];

export async function renderClaimsPage(container) {
  resetFilters();
  const initialSearch = new URLSearchParams(window.location.search).get("search") || "";
  state.filters.search = initialSearch;
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2>Claims</h2>
        <p class="text-sm">Search, filter and track every submitted claim.</p>
      </div>
      <div class="page-header__actions">
        <a href="/new-claim" class="btn btn-primary">${icon("plus", { size: 16 })}New Claim</a>
      </div>
    </div>

    <div class="filter-bar">
      <div class="filter-bar__search search-input">
        ${icon("search", { size: 16 })}
        <input type="text" id="claims-search" value="${initialSearch.replace(/"/g, "&quot;")}" placeholder="Search Claim ID, Product ID, product, serial or fault...">
      </div>
      <div id="filter-controls" style="display:flex;gap:var(--space-3);flex-wrap:wrap"></div>
      <div class="date-filter"><label for="submitted-from">From</label><input class="input" type="date" id="submitted-from"></div>
      <div class="date-filter"><label for="submitted-to">To</label><input class="input" type="date" id="submitted-to"></div>
      <button class="btn btn-ghost btn-sm" id="clear-filters">${icon("x-circle", { size: 14 })}Clear</button>
    </div>

    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Claim</th><th>Fault</th><th>Status</th><th>Warranty</th><th>Submitted</th><th></th>
          </tr>
        </thead>
        <tbody id="claims-tbody">${skeletonTableRows(PAGE_SIZE, 6)}</tbody>
      </table>
      <div class="pagination" id="pagination"></div>
    </div>
  `;

  renderFilterControls();
  document.getElementById("claims-search").addEventListener(
    "input",
    debounce((e) => {
      state.filters.search = e.target.value;
      currentPage = 1;
      loadClaims();
    }, 300)
  );
  document.getElementById("clear-filters").addEventListener("click", () => {
    resetFilters();
    document.getElementById("claims-search").value = "";
    renderFilterControls();
    currentPage = 1;
    loadClaims();
  });
  ["submitted-from", "submitted-to"].forEach((id) => document.getElementById(id).addEventListener("change", (event) => {
    state.filters[id === "submitted-from" ? "submittedFrom" : "submittedTo"] = event.target.value;
    currentPage = 1;
    loadClaims();
  }));

  loadClaims();
}

function renderFilterControls() {
  const slot = document.getElementById("filter-controls");
  const visible = FILTER_CONFIG.filter((f) => !f.staffOnly || isStaff(state.session?.role));
  slot.innerHTML = visible.map(
    (f) => `
    <div class="select-wrap">
      <select class="select" data-filter-key="${f.key}" style="min-width:150px" aria-label="${f.label}">
        ${f.options.map((o) => `<option value="${o.value}" ${state.filters[f.key] === o.value ? "selected" : ""}>${o.label}</option>`).join("")}
      </select>
    </div>`
  ).join("");

  slot.querySelectorAll("[data-filter-key]").forEach((select) => {
    select.addEventListener("change", (e) => {
      state.filters[e.target.dataset.filterKey] = e.target.value;
      currentPage = 1;
      loadClaims();
    });
  });

  // Filters whose options come from the backend (e.g. the list of reviewers).
  visible.filter((f) => f.loadOptions).forEach(async (f) => {
    try {
      const extra = await f.loadOptions();
      const select = slot.querySelector(`[data-filter-key="${f.key}"]`);
      select.insertAdjacentHTML("beforeend", extra.map((o) => `<option value="${o.value}">${o.label}</option>`).join(""));
    } catch (err) {
      // The filter still works with its fixed options.
    }
  });
}

async function loadClaims() {
  const tbody = document.getElementById("claims-tbody");
  tbody.innerHTML = skeletonTableRows(PAGE_SIZE, 6);
  try {
    allResults = await claimService.getClaims(state.filters);
    renderPage();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6">${errorState({ body: friendlyError(err), onRetry: loadClaims })}</td></tr>`;
  }
}

function renderPage() {
  const tbody = document.getElementById("claims-tbody");
  const pagination = document.getElementById("pagination");

  if (!allResults.length) {
    tbody.innerHTML = `<tr><td colspan="6">${emptyState({ title: "No claims match your current filters.", iconName: "search" })}</td></tr>`;
    pagination.innerHTML = "";
    return;
  }

  const totalPages = Math.max(1, Math.ceil(allResults.length / PAGE_SIZE));
  currentPage = Math.min(currentPage, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = allResults.slice(start, start + PAGE_SIZE);

  tbody.innerHTML = pageItems.map((c) => claimTableRow(c)).join("");
  pagination.innerHTML = `
    <span>Showing ${start + 1}–${Math.min(start + PAGE_SIZE, allResults.length)} of ${allResults.length} claims</span>
    <div class="pagination__controls">
      <button class="btn-icon" id="prev-page" ${currentPage === 1 ? "disabled" : ""}>${icon("chevron-left", { size: 15 })}</button>
      <button class="btn-icon" id="next-page" ${currentPage === totalPages ? "disabled" : ""}>${icon("chevron-right", { size: 15 })}</button>
    </div>`;

  document.getElementById("prev-page")?.addEventListener("click", () => { currentPage -= 1; renderPage(); });
  document.getElementById("next-page")?.addEventListener("click", () => { currentPage += 1; renderPage(); });
}
