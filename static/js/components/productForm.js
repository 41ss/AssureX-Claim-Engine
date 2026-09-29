/**
 * productForm.js — product + warranty registration form (SRS iii, iv, viii).
 * Used on the Products page and inside the New Claim flow. The warranty
 * expiry is filled in from the category policy's coverage length and can
 * be edited; an extended warranty adds a second provider and expiry date.
 */
import { icon } from "./icons.js";
import { CATEGORIES } from "../utils/claimOptions.js";
import { policyService } from "../services/policyService.js";

export function productFormHtml() {
  return `
    <div class="field__label" style="margin-bottom:var(--space-2)">Category</div>
    <div class="product-type-grid" data-pf="category-grid">
      ${CATEGORIES.map((c) => `<button type="button" class="product-type-card" data-category="${c.value}" title="${c.hint}">${icon(c.iconName, { size: 22 })}${c.label}<span class="text-xs text-muted">${c.hint}</span></button>`).join("")}
    </div>
    <div class="form-row">
      <div class="field"><label class="field__label">Product name</label><input class="input" data-pf="name" placeholder="e.g. Dell XPS 15"><div class="field__error"></div></div>
      <div class="field"><label class="field__label">Brand</label><input class="input" data-pf="brand" placeholder="e.g. Dell"><div class="field__error"></div></div>
    </div>
    <div class="form-row">
      <div class="field"><label class="field__label">Model number</label><input class="input" data-pf="model" placeholder="e.g. XPS 15 9530"><div class="field__error"></div></div>
      <div class="field"><label class="field__label">Serial number</label><input class="input" data-pf="serialNumber" placeholder="e.g. SN12345678"><div class="field__error"></div></div>
    </div>
    <div class="form-row">
      <div class="field"><label class="field__label">Purchase date</label><input class="input" type="date" data-pf="purchaseDate"><div class="field__error"></div></div>
      <div class="field"><label class="field__label">Purchase price</label><input class="input" type="number" min="0" data-pf="purchasePrice" placeholder="KES"><div class="field__error"></div></div>
    </div>
    <div class="form-row">
      <div class="field"><label class="field__label">Retailer</label><input class="input" data-pf="retailer" placeholder="Where it was purchased"><div class="field__error"></div></div>
      <div class="field"><label class="field__label">Warranty provider</label><input class="input" data-pf="provider" placeholder="e.g. Dell Premium Care"><div class="field__error"></div></div>
    </div>
    <div class="form-row">
      <div class="field"><label class="field__label">Warranty start date</label><input class="input" type="date" data-pf="start"><div class="field__error"></div></div>
      <div class="field"><label class="field__label">Warranty expiry <span class="optional" data-pf="expiry-hint"></span></label><input class="input" type="date" data-pf="expiry"><div class="field__error"></div></div>
    </div>
    <div class="form-row">
      <div class="field"><label class="field__label">Authorised service centre <span class="optional">(optional)</span></label><input class="input" data-pf="serviceCenter" placeholder="Name and contact"></div>
      <div class="field"><label class="field__label">Coverage conditions <span class="optional">(optional)</span></label><input class="input" data-pf="coverage" placeholder="Covered faults and terms"></div>
    </div>
    <div class="field"><label class="field__label">Warranty exclusions <span class="optional">(optional)</span></label><textarea class="textarea" data-pf="exclusions" placeholder="Excluded damage or conditions"></textarea></div>
    <label class="checkbox-row" style="margin-bottom:var(--space-3)"><input type="checkbox" data-pf="hasExtended">This product also has an extended warranty</label>
    <div class="form-row" data-pf="extended-fields" hidden>
      <div class="field"><label class="field__label">Extended warranty provider</label><input class="input" data-pf="extProvider"><div class="field__error"></div></div>
      <div class="field"><label class="field__label">Extended warranty expiry</label><input class="input" type="date" data-pf="extExpiry"><div class="field__error"></div></div>
    </div>`;
}

/** Wires category buttons, the expiry auto-fill and the extended-warranty toggle. */
export function wireProductForm(root) {
  const q = (k) => root.querySelector(`[data-pf="${k}"]`);
  let category = "";
  let expiryEdited = false;

  async function fillExpiry() {
    if (expiryEdited || !category) return;
    const start = q("start").value || q("purchaseDate").value;
    const policy = await policyService.getPolicy(category);
    if (!policy) return;
    q("expiry-hint").textContent = `(${policy.coverageMonths}-month policy)`;
    if (!start) return;
    const d = new Date(start);
    d.setMonth(d.getMonth() + policy.coverageMonths);
    q("expiry").value = d.toISOString().slice(0, 10);
  }

  root.querySelectorAll("[data-category]").forEach((btn) => {
    btn.addEventListener("click", () => {
      category = btn.dataset.category;
      root.querySelectorAll("[data-category]").forEach((b) => b.classList.toggle("is-selected", b === btn));
      fillExpiry();
    });
  });
  q("purchaseDate").addEventListener("change", () => {
    if (!q("start").value) q("start").value = q("purchaseDate").value;
    fillExpiry();
  });
  q("start").addEventListener("change", fillExpiry);
  q("expiry").addEventListener("change", () => { expiryEdited = true; });
  q("hasExtended").addEventListener("change", () => { q("extended-fields").hidden = !q("hasExtended").checked; });

  return {
    /** Returns the product payload, or null after marking the missing fields. */
    read() {
      const required = ["name", "brand", "model", "serialNumber", "purchaseDate", "retailer", "provider", "start", "expiry"];
      if (q("hasExtended").checked) required.push("extProvider", "extExpiry");
      let ok = true;
      required.forEach((k) => {
        const field = q(k).closest(".field");
        const missing = !q(k).value.trim();
        field.classList.toggle("has-error", missing);
        field.querySelector(".field__error").textContent = missing ? "This field is required." : "";
        ok = ok && !missing;
      });
      if (!category) {
        q("category-grid").scrollIntoView({ block: "center" });
        ok = false;
      }
      if (!ok) return null;
      return {
        name: q("name").value.trim(),
        category,
        brand: q("brand").value.trim(),
        model: q("model").value.trim(),
        serialNumber: q("serialNumber").value.trim(),
        purchaseDate: q("purchaseDate").value,
        purchasePrice: Number(q("purchasePrice").value || 0),
        retailer: q("retailer").value.trim(),
        warranty: {
          provider: q("provider").value.trim(),
          start: q("start").value,
          expiry: q("expiry").value,
          serviceCenter: q("serviceCenter").value.trim(),
          coverage: q("coverage").value.trim(),
          exclusions: q("exclusions").value.trim(),
        },
        extendedWarranty: q("hasExtended").checked ? { provider: q("extProvider").value.trim(), expiry: q("extExpiry").value } : null,
      };
    },
    categoryMissing() { return !category; },
  };
}
