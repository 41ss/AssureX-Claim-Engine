/**
 * pages/products.js — registered products, their warranties and repairs.
 * Covers product registration (SRS iii), warranty records with active /
 * expiring / expired / extended status (iv, viii) and repair history (xiii).
 * Warranty status and days left are calculated by the backend.
 */
import { productService } from "../services/productService.js";
import { icon } from "../components/icons.js";
import { statusBadge } from "../components/statusBadge.js";
import { productFormHtml, wireProductForm } from "../components/productForm.js";
import { mountRepairHistory } from "../components/repairHistory.js";
import { skeletonCards } from "../components/loadingState.js";
import { errorState, friendlyError } from "../components/errorState.js";
import { emptyState } from "../components/emptyState.js";
import { formatDate, formatCurrency } from "../utils/formatters.js";
import { debounce, escapeHtml } from "../utils/helpers.js";
import { categoryIcon, categoryLabel } from "../utils/claimOptions.js";
import { showToast } from "../components/toast.js";

let products = [];

export async function renderProductsPage(container) {
  container.innerHTML = `
    <div class="page-header">
      <div><h2>Products & Warranty</h2><p class="text-sm">Every registered product, its warranty status and repair history.</p></div>
      <div class="page-header__actions"><button class="btn btn-primary" id="register-btn" type="button">${icon("plus", { size: 16 })}Register Product</button></div>
    </div>
    <form class="card registration-panel" id="product-registration" hidden novalidate>
      <div class="card__header"><div><div class="card__title">Register a product</div><div class="card__subtitle">Each product gets a Product ID; its warranty expiry is calculated from the category policy.</div></div></div>
      ${productFormHtml()}
      <div class="page-header__actions" style="margin-top:var(--space-4)"><button class="btn btn-secondary" type="button" id="cancel-registration">Cancel</button><button class="btn btn-primary" type="submit">Save product</button></div>
    </form>
    <div class="filter-bar">
      <div class="filter-bar__search search-input">${icon("search", { size: 16 })}<input type="text" id="product-search" placeholder="Search by Product ID, name or serial number..."></div>
      <div class="select-wrap"><select class="select" id="warranty-filter">
        <option value="all">Any warranty status</option><option value="active">Active</option><option value="expiring">Expiring soon</option><option value="extended">Extended</option><option value="expired">Expired</option>
      </select></div>
    </div>
    <div id="products-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:var(--space-4)">${skeletonCards(6)}</div>
  `;

  const registration = document.getElementById("product-registration");
  const form = wireProductForm(registration);
  document.getElementById("register-btn").addEventListener("click", () => {
    registration.hidden = !registration.hidden;
    if (!registration.hidden) registration.querySelector("input")?.focus();
  });
  document.getElementById("cancel-registration").addEventListener("click", () => { registration.hidden = true; });
  registration.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = form.read();
    if (!payload) {
      showToast(form.categoryMissing() ? "Choose the product category." : "Please fill in the highlighted fields.", "error");
      return;
    }
    try {
      const product = await productService.registerProduct(payload);
      registration.hidden = true;
      showToast(`Product registered as ${product.id}.`, "success");
      loadProducts();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  const reload = () => loadProducts({ search: document.getElementById("product-search").value, warrantyStatus: document.getElementById("warranty-filter").value });
  document.getElementById("product-search").addEventListener("input", debounce(reload, 300));
  document.getElementById("warranty-filter").addEventListener("change", reload);
  loadProducts();
}

let productsRequestId = 0;

async function loadProducts(filters = {}) {
  const requestId = ++productsRequestId;
  const grid = document.getElementById("products-grid");
  try {
    products = await productService.getProducts(filters);
    if (requestId !== productsRequestId) return;
    grid.innerHTML = products.length
      ? products.map(productCard).join("")
      : `<div style="grid-column:1/-1">${emptyState({ title: "No products found", body: "Register a product or try a different search.", iconName: "package" })}</div>`;
    grid.querySelectorAll("[data-repairs]").forEach((btn) => btn.addEventListener("click", () => {
      const slot = grid.querySelector(`[data-repair-slot="${btn.dataset.repairs}"]`);
      slot.hidden = !slot.hidden;
      if (!slot.hidden && !slot.dataset.mounted) {
        mountRepairHistory(slot, products.find((p) => p.id === btn.dataset.repairs));
        slot.dataset.mounted = "1";
      }
    }));
  } catch (err) {
    if (requestId !== productsRequestId) return;
    grid.innerHTML = `<div style="grid-column:1/-1">${errorState({ body: friendlyError(err), onRetry: () => loadProducts(filters) })}</div>`;
  }
}

function productCard(p) {
  const w = p.warranty || {};
  const daysNote = w.status === "expired" ? `expired ${Math.abs(w.daysLeft)} days ago` : `${w.daysLeft} days left`;
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--space-3)">
        <div class="icon-tile">${icon(categoryIcon(p.category), { size: 18 })}</div>
        ${statusBadge(w.status)}
      </div>
      <div class="card__title">${escapeHtml(p.name)}</div>
      <div class="text-xs text-muted" style="margin-bottom:var(--space-3)">${p.id} · ${categoryLabel(p.category)} · ${escapeHtml(p.brand)} ${escapeHtml(p.model)}</div>
      <div class="detail-row"><dt>Serial</dt><dd>${escapeHtml(p.serialNumber)}</dd></div>
      <div class="detail-row"><dt>Purchased</dt><dd>${formatDate(p.purchaseDate)} · ${escapeHtml(p.retailer || "—")}</dd></div>
      <div class="detail-row"><dt>Price</dt><dd>${formatCurrency(p.purchasePrice)}</dd></div>
      <div class="detail-row"><dt>Warranty</dt><dd>${escapeHtml(w.provider || "—")}</dd></div>
      <div class="detail-row"><dt>Coverage</dt><dd>${formatDate(w.start)} – ${formatDate(w.expiry)}<div class="text-xs text-muted" style="font-weight:400">${daysNote}</div></dd></div>
      ${w.extended ? `<div class="detail-row"><dt>Extended</dt><dd>${escapeHtml(w.extended.provider)} to ${formatDate(w.extended.expiry)}</dd></div>` : ""}
      <div class="detail-row"><dt>Claims filed</dt><dd>${p.claimCount ?? 0}</dd></div>
      <button class="btn btn-ghost btn-sm" type="button" data-repairs="${p.id}" style="margin-top:var(--space-2)">${icon("history", { size: 14 })}Repair history (${(p.repairs || []).length})</button>
      <div data-repair-slot="${p.id}" hidden style="margin-top:var(--space-3)"></div>
    </div>`;
}
