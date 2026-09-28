/**
 * pages/products.js — registered products & their warranty status.
 * Registration and expiry calculation belong to the platform team;
 * this page only displays what productService returns.
 */
import { productService } from "../services/productService.js";
import { icon, productTypeIcon } from "../components/icons.js";
import { skeletonCards } from "../components/loadingState.js";
import { errorState, friendlyError } from "../components/errorState.js";
import { emptyState } from "../components/emptyState.js";
import { formatDate, formatCurrency, daysUntil } from "../utils/formatters.js";
import { debounce } from "../utils/helpers.js";

export async function renderProductsPage(container) {
  container.innerHTML = `
    <div class="page-header">
      <div><h2>Products & Warranty</h2><p class="text-sm">Every registered product and its current warranty status.</p></div>
      <div class="page-header__actions"><button class="btn btn-primary" id="register-btn">${icon("plus", { size: 16 })}Register Product</button></div>
    </div>
    <div class="filter-bar">
      <div class="filter-bar__search search-input">${icon("search", { size: 16 })}<input type="text" id="product-search" placeholder="Search by product name or serial number..."></div>
    </div>
    <div id="products-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--space-4)">${skeletonCards(6)}</div>
  `;

  document.getElementById("register-btn").addEventListener("click", () => {
    window.location.href = "/new-claim";
  });

  document.getElementById("product-search").addEventListener(
    "input",
    debounce((e) => loadProducts({ search: e.target.value }), 300)
  );

  loadProducts();
}

async function loadProducts(filters = {}) {
  const grid = document.getElementById("products-grid");
  try {
    const products = await productService.getProducts(filters);
    grid.innerHTML = products.length
      ? products.map(productCard).join("")
      : `<div style="grid-column:1/-1">${emptyState({ title: "No products found", body: "Try a different search term.", iconName: "package" })}</div>`;
  } catch (err) {
    grid.innerHTML = `<div style="grid-column:1/-1">${errorState({ body: friendlyError(err), onRetry: () => loadProducts(filters) })}</div>`;
  }
}

function productCard(p) {
  const remaining = daysUntil(p.warranty.expiry);
  const statusLabel = p.warranty.status === "active" ? "Warranty Active" : p.warranty.status === "expiring" ? `Expires in ${remaining} days` : "Warranty Expired";
  const statusCls = p.warranty.status === "active" ? "badge--approved" : p.warranty.status === "expiring" ? "badge--warning" : "badge--rejected";
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--space-3)">
        <div class="icon-tile">${icon(productTypeIcon(p.type), { size: 18 })}</div>
        <span class="badge ${statusCls}">${statusLabel}</span>
      </div>
      <div class="card__title">${p.name}</div>
      <div class="text-xs text-muted" style="margin-bottom:var(--space-3)">${p.brand} · ${p.model}</div>
      <div class="detail-row"><dt>Serial</dt><dd>${p.serialNumber}</dd></div>
      <div class="detail-row"><dt>Purchased</dt><dd>${formatDate(p.purchaseDate)}</dd></div>
      <div class="detail-row"><dt>Price</dt><dd>${formatCurrency(p.purchasePrice)}</dd></div>
      <div class="detail-row"><dt>Warranty expiry</dt><dd>${formatDate(p.warranty.expiry)}</dd></div>
      <div class="detail-row"><dt>Claims filed</dt><dd>${p.claimHistory.length}</dd></div>
    </div>`;
}
