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
import { showToast } from "../components/toast.js";

export async function renderProductsPage(container) {
  container.innerHTML = `
    <div class="page-header">
      <div><h2>Products & Warranty</h2><p class="text-sm">Every registered product and its current warranty status.</p></div>
      <div class="page-header__actions"><button class="btn btn-primary" id="register-btn" type="button">${icon("plus", { size: 16 })}Register Product</button></div>
    </div>
    <form class="card registration-panel" id="product-registration" hidden novalidate>
      <div class="card__header"><div><div class="card__title">Register a product</div><div class="card__subtitle">Save the product and warranty details you will use when submitting a claim.</div></div></div>
      <div class="form-row">
        <div class="field"><label class="field__label" for="product-name">Product name</label><input class="input" id="product-name" required placeholder="e.g. Dell XPS 15"><div class="field__error"></div></div>
        <div class="field"><label class="field__label" for="product-type">Category</label><select class="select" id="product-type"><option value="laptop">Laptop</option><option value="phone">Phone / Audio</option><option value="appliance">Home Appliance</option><option value="vehicle">Vehicle</option><option value="camera">Camera</option><option value="other">Other</option></select></div>
      </div>
      <div class="form-row">
        <div class="field"><label class="field__label" for="product-brand">Brand</label><input class="input" id="product-brand" required placeholder="e.g. Dell"><div class="field__error"></div></div>
        <div class="field"><label class="field__label" for="product-model">Model number</label><input class="input" id="product-model" required placeholder="e.g. XPS 15 9530"><div class="field__error"></div></div>
      </div>
      <div class="form-row">
        <div class="field"><label class="field__label" for="product-serial">Serial number</label><input class="input" id="product-serial" required placeholder="e.g. SN12345678"><div class="field__error"></div></div>
        <div class="field"><label class="field__label" for="product-retailer">Retailer</label><input class="input" id="product-retailer" required placeholder="Where it was purchased"><div class="field__error"></div></div>
      </div>
      <div class="form-row">
        <div class="field"><label class="field__label" for="product-purchase-date">Purchase date</label><input class="input" type="date" id="product-purchase-date" required><div class="field__error"></div></div>
        <div class="field"><label class="field__label" for="product-price">Purchase price</label><input class="input" type="number" min="0" id="product-price" required placeholder="KES"><div class="field__error"></div></div>
      </div>
      <div class="form-row">
        <div class="field"><label class="field__label" for="warranty-provider">Warranty provider</label><input class="input" id="warranty-provider" required placeholder="e.g. Dell Premium Care"><div class="field__error"></div></div>
        <div class="field"><label class="field__label" for="warranty-start">Warranty start date</label><input class="input" type="date" id="warranty-start" required><div class="field__error"></div></div>
      </div>
      <div class="form-row">
        <div class="field"><label class="field__label" for="warranty-expiry">Warranty expiry date</label><input class="input" type="date" id="warranty-expiry" required><div class="field__error"></div></div>
        <div class="field"><label class="field__label" for="warranty-coverage">Coverage conditions</label><input class="input" id="warranty-coverage" required placeholder="Covered faults and terms"><div class="field__error"></div></div>
      </div>
      <div class="field"><label class="field__label" for="warranty-exclusions">Warranty exclusions <span class="optional">(optional)</span></label><textarea class="textarea" id="warranty-exclusions" placeholder="Excluded damage or conditions"></textarea></div>
      <div class="page-header__actions"><button class="btn btn-secondary" type="button" id="cancel-registration">Cancel</button><button class="btn btn-primary" type="submit">Save product</button></div>
    </form>
    <div class="filter-bar">
      <div class="filter-bar__search search-input">${icon("search", { size: 16 })}<input type="text" id="product-search" placeholder="Search by product name or serial number..."></div>
    </div>
    <div id="products-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--space-4)">${skeletonCards(6)}</div>
  `;

  const registration = document.getElementById("product-registration");
  document.getElementById("register-btn").addEventListener("click", () => {
    registration.hidden = !registration.hidden;
    if (!registration.hidden) registration.querySelector("input")?.focus();
  });
  document.getElementById("cancel-registration").addEventListener("click", () => { registration.hidden = true; });
  registration.addEventListener("submit", async (event) => {
    event.preventDefault();
    const required = ["product-name", "product-brand", "product-model", "product-serial", "product-retailer", "product-purchase-date", "product-price", "warranty-provider", "warranty-start", "warranty-expiry", "warranty-coverage"];
    let valid = true;
    required.forEach((id) => {
      const input = document.getElementById(id);
      const field = input.closest(".field");
      field.classList.toggle("has-error", !input.value.trim());
      field.querySelector(".field__error").textContent = input.value.trim() ? "" : "This field is required.";
      valid = valid && Boolean(input.value.trim());
    });
    if (!valid) return;
    await productService.registerProduct({
      name: document.getElementById("product-name").value.trim(),
      type: document.getElementById("product-type").value,
      brand: document.getElementById("product-brand").value.trim(),
      model: document.getElementById("product-model").value.trim(),
      serialNumber: document.getElementById("product-serial").value.trim(),
      retailer: document.getElementById("product-retailer").value.trim(),
      purchaseDate: document.getElementById("product-purchase-date").value,
      purchasePrice: Number(document.getElementById("product-price").value),
      warranty: {
        provider: document.getElementById("warranty-provider").value.trim(),
        start: document.getElementById("warranty-start").value,
        expiry: document.getElementById("warranty-expiry").value,
        coverage: document.getElementById("warranty-coverage").value.trim(),
        exclusions: document.getElementById("warranty-exclusions").value.trim(),
        status: "active",
      },
    });
    registration.reset();
    registration.hidden = true;
    showToast("Product registered successfully.", "success");
    loadProducts();
  });

  document.getElementById("product-search").addEventListener(
    "input",
    debounce((e) => loadProducts({ search: e.target.value }), 300)
  );

  loadProducts();
}

let productsRequestId = 0;

async function loadProducts(filters = {}) {
  const requestId = ++productsRequestId;
  const grid = document.getElementById("products-grid");
  try {
    const products = await productService.getProducts(filters);
    if (requestId !== productsRequestId) return;
    grid.innerHTML = products.length
      ? products.map(productCard).join("")
      : `<div style="grid-column:1/-1">${emptyState({ title: "No products found", body: "Try a different search term.", iconName: "package" })}</div>`;
  } catch (err) {
    if (requestId !== productsRequestId) return;
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
