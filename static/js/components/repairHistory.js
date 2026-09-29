/**
 * repairHistory.js — list and add repair records for one product (SRS xiii).
 * Each repair is saved to the product straight away, so the claim form and
 * the Products page show the same history. The rule engine reads the count
 * and whether any repair was done at an unauthorised centre.
 */
import { icon } from "./icons.js";
import { productService } from "../services/productService.js";
import { showToast } from "./toast.js";
import { escapeHtml } from "../utils/helpers.js";
import { formatDate, formatCurrency } from "../utils/formatters.js";

export function mountRepairHistory(container, product, { onChange } = {}) {
  const repairs = [...(product.repairs || [])];

  function render() {
    container.innerHTML = `
      ${repairs.length
        ? `<div class="table-wrap" style="margin-bottom:var(--space-3)"><table class="data-table"><thead><tr><th>Date</th><th>Service centre</th><th>Parts / outcome</th><th>Cost</th></tr></thead><tbody>
            ${repairs.map((r) => `<tr>
              <td data-label="Date">${formatDate(r.date)}</td>
              <td data-label="Service centre">${escapeHtml(r.serviceCenter || "—")} ${r.authorized ? "" : `<span class="badge badge--warning">Unauthorised</span>`}</td>
              <td data-label="Parts / outcome">${escapeHtml([r.partsReplaced, r.outcome].filter(Boolean).join(" · ") || "—")}</td>
              <td data-label="Cost">${r.cost ? formatCurrency(r.cost) : "—"}</td></tr>`).join("")}
          </tbody></table></div>`
        : `<p class="text-sm text-muted" style="margin-bottom:var(--space-3)">No repairs recorded for this product.</p>`}
      <details class="repair-add">
        <summary class="btn btn-secondary btn-sm">${icon("plus", { size: 14 })}Add a previous repair</summary>
        <div class="form-row" style="margin-top:var(--space-3)">
          <div class="field"><label class="field__label">Repair date</label><input class="input" type="date" data-r="date"></div>
          <div class="field"><label class="field__label">Service centre</label><input class="input" data-r="serviceCenter" placeholder="Name of the repair shop"></div>
        </div>
        <div class="form-row">
          <div class="field"><label class="field__label">Parts replaced <span class="optional">(optional)</span></label><input class="input" data-r="partsReplaced"></div>
          <div class="field"><label class="field__label">Outcome <span class="optional">(optional)</span></label><input class="input" data-r="outcome" placeholder="e.g. Fixed, not fixed"></div>
        </div>
        <div class="form-row">
          <div class="field"><label class="field__label">Cost <span class="optional">(optional)</span></label><input class="input" type="number" min="0" data-r="cost" placeholder="KES"></div>
          <div class="field"><label class="field__label">Authorised service centre?</label>
            <div class="select-wrap"><select class="select" data-r="authorized"><option value="true">Yes — authorised by the manufacturer</option><option value="false">No — independent / unauthorised</option></select></div></div>
        </div>
        <label class="checkbox-row" style="margin-bottom:var(--space-3)"><input type="checkbox" data-r="productReplaced">The product was replaced (not repaired)</label>
        <button class="btn btn-primary btn-sm" type="button" data-save-repair>Save repair</button>
      </details>`;

    container.querySelector("[data-save-repair]").onclick = async () => {
      const get = (k) => container.querySelector(`[data-r="${k}"]`);
      const repair = {
        date: get("date").value,
        serviceCenter: get("serviceCenter").value.trim(),
        partsReplaced: get("partsReplaced").value.trim(),
        outcome: get("outcome").value.trim(),
        cost: Number(get("cost").value || 0),
        authorized: get("authorized").value === "true",
        productReplaced: get("productReplaced").checked,
      };
      if (!repair.date || !repair.serviceCenter) {
        showToast("Enter at least the repair date and service centre.", "error");
        return;
      }
      try {
        const saved = await productService.addRepair(product.id, repair);
        repairs.push(saved);
        render();
        onChange?.(repairs);
        showToast("Repair saved to the product history.", "success");
      } catch (err) {
        showToast(err.message, "error");
      }
    };
  }

  render();
  return { getRepairs: () => repairs };
}
