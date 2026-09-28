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

const FILTER_CONFIG = [
  {
    key: "status",
    label: "Status",
    options: [
      { value: "all", label: "All Statuses" },
      { value: "approved", label: "Approved" },
      { value: "rejected", label: "Rejected" },
      { value: "review", label: "Under Review" },
    ],
  },
  {
    key: "productType",
    label: "Product",
    options: [
      { value: "all", label: "All Products" },
      { value: "laptop", label: "Laptops" },
      { value: "phone", label: "Phones & Audio" },
      { value: "appliance", label: "Home Appliances" },
      { value: "vehicle", label: "Vehicles" },
      { value: "camera", label: "Cameras" },
    ],
  },
  {
    key: "warrantyStatus",
    label: "Warranty",
    options: [
      { value: "all", label: "Any Warranty Status" },
      { value: "active", label: "Active" },
      { value: "expired", label: "Expired" },
    ],
  },
];

const PAGE_SIZE = 6;
let currentPage = 1;
let allResults = [];

export async function renderClaimsPage(container) {
  resetFilters();
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
        <input type="text" id="claims-search" placeholder="Search by Claim ID, product or fault type...">
      </div>
      <div id="filter-controls" style="display:flex;gap:var(--space-3);flex-wrap:wrap"></div>
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

  loadClaims();
}

function renderFilterControls() {
  const slot = document.getElementById("filter-controls");
  slot.innerHTML = FILTER_CONFIG.map(
    (f) => `
    <div class="select-wrap">
      <select class="select" data-filter-key="${f.key}" style="min-width:150px">
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
