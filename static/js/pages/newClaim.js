/**
 * pages/newClaim.js — the 5-step new-claim flow.
 * Steps: Product -> Claim Details -> Documents -> Review -> Result.
 *
 * The claim is saved as a Draft when the user leaves Claim Details, so
 * documents can be uploaded against its Claim ID and read by OCR. This
 * page never decides claim validity: Submit asks the backend to run both
 * models and the decision engine, and shows what comes back.
 */
import { icon } from "../components/icons.js";
import { mountUploader } from "../components/fileUpload.js";
import { mountRepairHistory } from "../components/repairHistory.js";
import { productFormHtml, wireProductForm } from "../components/productForm.js";
import { claimService } from "../services/claimService.js";
import { productService } from "../services/productService.js";
import { policyService } from "../services/policyService.js";
import { showToast } from "../components/toast.js";
import { statusBadge } from "../components/statusBadge.js";
import { isRequired, isValidDate } from "../utils/validators.js";
import { escapeHtml } from "../utils/helpers.js";
import { formatDate } from "../utils/formatters.js";
import { DAMAGE_TYPES, categoryIcon, categoryLabel, docTypeLabel, humanize } from "../utils/claimOptions.js";
import { navigate } from "../router.js";

const STEPS = ["Product", "Claim Details", "Documents", "Review", "Result"];

let step = 0;
let container;
let draft;

function emptyDraft() {
  return {
    product: null,          // the selected registered product
    registering: false,     // showing the inline "new product" form
    policy: null,           // warranty policy for the product's category
    claimId: null,
    details: {
      faultCategory: "", damageType: "none", faultDate: "", description: "",
      serialNumber: "", invoiceNumber: "", previousReplacement: false, replacementDetails: "", notes: "",
    },
    documents: {},          // docType -> uploaded documents
  };
}

export function renderNewClaimPage(root) {
  container = root;
  step = 0;
  draft = emptyDraft();
  container.innerHTML = `
    <div class="page-header"><div><h2>New Claim</h2><p class="text-sm">Complete each step — the claim is saved as a draft and you can come back to edit it before submitting.</p></div></div>
    <div class="stepper" id="stepper"></div>
    <div class="step-panel" id="step-panel"></div>
  `;
  renderStep();
}

function renderStepper() {
  document.getElementById("stepper").innerHTML = STEPS.map((label, i) => {
    const cls = i < step ? "is-done" : i === step ? "is-active" : "";
    return `
      <div class="stepper__step ${cls}">
        <div class="stepper__num">${i < step ? icon("check-circle-2", { size: 14 }) : String(i + 1).padStart(2, "0")}</div>
        <span>${label}</span>
      </div>
      ${i < STEPS.length - 1 ? '<div class="stepper__line"></div>' : ""}`;
  }).join("");
}

async function renderStep() {
  renderStepper();
  const panel = document.getElementById("step-panel");
  panel.innerHTML = `<div class="card"><p class="text-sm text-muted">Loading…</p></div>`;
  try {
    if (step === 0) await productStep(panel);
    else if (step === 1) detailsStep(panel);
    else if (step === 2) documentsStep(panel);
    else if (step === 3) await reviewStep(panel);
    else await resultStep(panel);
  } catch (err) {
    panel.innerHTML = `<div class="alert alert--danger">${icon("alert-triangle", { size: 18 })}<div>${escapeHtml(err.message)}</div></div>`;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function footer({ next = "Continue", back = step > 0 } = {}) {
  return `
    <div style="margin-top:var(--space-6);justify-content:flex-end;display:flex;gap:var(--space-3)">
      ${back ? `<button class="btn btn-secondary" id="btn-back" type="button">${icon("arrow-left", { size: 15 })}Back</button>` : ""}
      <button class="btn btn-primary" id="btn-next" type="button">${next}${icon("chevron-right", { size: 15 })}</button>
    </div>`;
}

function wireBack() {
  document.getElementById("btn-back")?.addEventListener("click", () => { step -= 1; renderStep(); });
}

/* ---------------- Step 1: Product ---------------- */
async function productStep(panel) {
  const products = await productService.getProducts();
  panel.innerHTML = `
    <div class="card">
      <div class="card__title" style="margin-bottom:var(--space-4)">Which product is this claim for?</div>
      ${products.length ? `<div class="product-pick-grid">
        ${products.map((p) => `
          <button type="button" class="product-pick ${draft.product?.id === p.id ? "is-selected" : ""}" data-product="${p.id}">
            <div class="icon-tile">${icon(categoryIcon(p.category), { size: 18 })}</div>
            <div class="product-pick__body">
              <div class="product-pick__head"><span class="card__title">${escapeHtml(p.name)}</span>${statusBadge(p.warranty?.status || "active")}</div>
              <div class="text-xs text-muted">${p.id} · ${escapeHtml(p.brand)} ${escapeHtml(p.model)} · SN ${escapeHtml(p.serialNumber)}</div>
              <div class="text-xs text-muted">${categoryLabel(p.category)} · warranty to ${formatDate(p.warranty?.expiry)}</div>
            </div>
          </button>`).join("")}
      </div>` : `<p class="text-sm text-muted">You have no registered products yet.</p>`}
      <button type="button" class="btn btn-secondary" id="toggle-register" style="margin-top:var(--space-4)">${icon("plus", { size: 15 })}Register a new product</button>
      <div id="register-slot" ${draft.registering ? "" : "hidden"} style="margin-top:var(--space-4)">${productFormHtml()}</div>
    </div>
    ${footer({ back: false })}`;

  const form = wireProductForm(panel.querySelector("#register-slot"));
  panel.querySelectorAll("[data-product]").forEach((btn) => btn.addEventListener("click", () => {
    draft.product = products.find((p) => p.id === btn.dataset.product);
    draft.registering = false;
    panel.querySelector("#register-slot").hidden = true;
    panel.querySelectorAll("[data-product]").forEach((b) => b.classList.toggle("is-selected", b === btn));
  }));
  panel.querySelector("#toggle-register").addEventListener("click", () => {
    draft.registering = !draft.registering;
    panel.querySelector("#register-slot").hidden = !draft.registering;
    if (draft.registering) {
      draft.product = null;
      panel.querySelectorAll("[data-product]").forEach((b) => b.classList.remove("is-selected"));
    }
  });

  document.getElementById("btn-next").addEventListener("click", async () => {
    if (draft.registering) {
      const payload = form.read();
      if (!payload) {
        showToast(form.categoryMissing() ? "Choose the product category." : "Please fill in the highlighted fields.", "error");
        return;
      }
      try {
        draft.product = await productService.registerProduct(payload);
        draft.registering = false;
        showToast(`Product registered as ${draft.product.id}.`, "success");
      } catch (err) {
        showToast(err.message, "error");
        return;
      }
    }
    if (!draft.product) {
      showToast("Choose a product or register a new one.", "error");
      return;
    }
    if (draft.claimId && draft.product.id !== draft.productIdAtDraft) draft.claimId = null; // product changed: start a new draft
    draft.policy = await policyService.getPolicy(draft.product.category);
    if (!draft.details.serialNumber) draft.details.serialNumber = draft.product.serialNumber;
    step = 1;
    renderStep();
  });
}

/* ---------------- Step 2: Claim Details ---------------- */
function detailsStep(panel) {
  const d = draft.details;
  const p = draft.policy;
  const coveredFaults = p?.coveredFaults || [];
  const otherFaults = (p?.exclusions || []).filter((f) => f !== "physical_damage" && f !== "water_damage");
  panel.innerHTML = `
    <div class="card" style="margin-bottom:var(--space-4)">
      <div class="card__header"><div><div class="card__title">What went wrong?</div><div class="card__subtitle">${escapeHtml(draft.product.name)} · ${categoryLabel(draft.product.category)}</div></div></div>
      <div class="form-row">
        <div class="field">
          <label class="field__label" for="d-fault">Fault</label>
          <div class="select-wrap"><select class="select" id="d-fault">
            <option value="">Choose the fault…</option>
            <optgroup label="Faults covered by this warranty">${coveredFaults.map((f) => `<option value="${f}" ${d.faultCategory === f ? "selected" : ""}>${humanize(f)}</option>`).join("")}</optgroup>
            <optgroup label="Usually not covered">${otherFaults.map((f) => `<option value="${f}" ${d.faultCategory === f ? "selected" : ""}>${humanize(f)}</option>`).join("")}</optgroup>
            <option value="other" ${d.faultCategory === "other" ? "selected" : ""}>Something else</option>
          </select></div>
          <div class="field__error"></div>
        </div>
        <div class="field">
          <label class="field__label" for="d-damage">Physical or liquid damage?</label>
          <div class="select-wrap"><select class="select" id="d-damage">${DAMAGE_TYPES.map((t) => `<option value="${t.value}" ${d.damageType === t.value ? "selected" : ""}>${t.label}</option>`).join("")}</select></div>
        </div>
      </div>
      <div class="form-row">
        <div class="field">
          <label class="field__label" for="d-fault-date">Date the fault started</label>
          <input class="input" type="date" id="d-fault-date" value="${d.faultDate}">
          <div class="field__error"></div>
        </div>
        <div class="field">
          <label class="field__label" for="d-serial">Serial number on the product</label>
          <input class="input" id="d-serial" value="${escapeHtml(d.serialNumber)}">
          <div class="field__hint text-xs text-muted">Compared with the receipt, warranty card and photos.</div>
        </div>
      </div>
      <div class="field">
        <label class="field__label" for="d-description">Describe the fault</label>
        <textarea class="textarea" id="d-description" placeholder="What happened, and what the product does now…">${escapeHtml(d.description)}</textarea>
        <div class="field__error"></div>
      </div>
      <div class="form-row">
        <div class="field"><label class="field__label" for="d-invoice">Invoice number <span class="optional">(optional)</span></label><input class="input" id="d-invoice" value="${escapeHtml(d.invoiceNumber)}" placeholder="As printed on the receipt"></div>
        <div class="field"><label class="field__label" for="d-replaced">Has the product been replaced under warranty before?</label>
          <div class="select-wrap"><select class="select" id="d-replaced"><option value="no">No</option><option value="yes" ${d.previousReplacement ? "selected" : ""}>Yes</option></select></div></div>
      </div>
      <div class="field" id="replacement-details-field" ${d.previousReplacement ? "" : "hidden"}><label class="field__label" for="d-replacement">Replacement details</label><input class="input" id="d-replacement" value="${escapeHtml(d.replacementDetails)}" placeholder="When and why it was replaced"></div>
      <div class="field"><label class="field__label" for="d-notes">Anything else the reviewer should know? <span class="optional">(optional)</span></label><textarea class="textarea" id="d-notes">${escapeHtml(d.notes)}</textarea></div>
    </div>
    <div class="card">
      <div class="card__header"><div><div class="card__title">Repair history</div><div class="card__subtitle">Earlier repairs on this product, including where they were done.</div></div></div>
      <div id="repairs-slot"></div>
    </div>
    ${footer()}`;

  mountRepairHistory(panel.querySelector("#repairs-slot"), draft.product, {
    onChange: (repairs) => { draft.product.repairs = repairs; },
  });
  panel.querySelector("#d-replaced").addEventListener("change", (e) => {
    panel.querySelector("#replacement-details-field").hidden = e.target.value !== "yes";
  });
  wireBack();

  document.getElementById("btn-next").addEventListener("click", async () => {
    Object.assign(d, {
      faultCategory: val("d-fault"), damageType: val("d-damage"), faultDate: val("d-fault-date"),
      description: val("d-description"), serialNumber: val("d-serial"), invoiceNumber: val("d-invoice"),
      previousReplacement: val("d-replaced") === "yes", replacementDetails: val("d-replacement"), notes: val("d-notes"),
    });
    let ok = true;
    ["d-fault", "d-fault-date", "d-description"].forEach(clearErr);
    if (!d.faultCategory) { setErr("d-fault", "Choose the fault."); ok = false; }
    if (!isValidDate(d.faultDate)) { setErr("d-fault-date", "Enter a valid date."); ok = false; }
    if (!isRequired(d.description)) { setErr("d-description", "Please describe the fault."); ok = false; }
    if (!ok) return;

    const payload = { productId: draft.product.id, ...d };
    try {
      const claim = draft.claimId ? await claimService.updateDraft(draft.claimId, payload) : await claimService.createDraft(payload);
      draft.claimId = claim.id;
      draft.productIdAtDraft = draft.product.id;
      step = 2;
      renderStep();
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

/* ---------------- Step 3: Documents ---------------- */
function documentsStep(panel) {
  const mandatory = draft.policy?.mandatoryDocuments || ["receipt"];
  const optional = draft.policy?.optionalDocuments || [];
  const slot = (type, required) => `
    <div style="margin-bottom:var(--space-6)">
      <div class="field__label" style="margin-bottom:var(--space-2)">${docTypeLabel(type)} ${required ? `<span class="badge badge--review">Required</span>` : `<span class="optional">(optional)</span>`}</div>
      <div id="uploader-${type}"></div>
    </div>`;
  panel.innerHTML = `
    <div class="card">
      <div class="card__header"><div><div class="card__title">Supporting documents</div><div class="card__subtitle">Claim ${draft.claimId} · receipts and warranty cards are read automatically — check what was read before continuing.</div></div></div>
      ${mandatory.map((t) => slot(t, true)).join("")}
      ${optional.map((t) => slot(t, false)).join("")}
    </div>
    ${footer()}`;

  [...mandatory, ...optional].forEach((type) => {
    mountUploader(panel.querySelector(`#uploader-${type}`), {
      claimId: draft.claimId,
      docType: type,
      docLabel: docTypeLabel(type),
      video: type === "fault_video" || type === "fault_evidence",
      initial: draft.documents[type] || [],
      onChange: (docs) => { draft.documents[type] = docs.filter((x) => x.id); },
    });
  });
  wireBack();
  document.getElementById("btn-next").addEventListener("click", () => { step = 3; renderStep(); });
}

/* ---------------- Step 4: Review (claim preparation, SRS xxxiii) ---------------- */
async function reviewStep(panel) {
  const prep = await claimService.getPreparation(draft.claimId);
  const d = draft.details;
  const readiness = Math.round((prep.readiness || 0) * 100);
  const list = (items, cls, iconName) => items.map((t) => `<div class="check-item ${cls}">${icon(iconName, { size: 16 })}${escapeHtml(t)}</div>`).join("");
  panel.innerHTML = `
    <div class="claim-detail-grid">
      <div>
        <div class="card" style="margin-bottom:var(--space-4)">
          <div class="card__header"><div class="card__title">Claim ${draft.claimId}</div><button class="btn btn-ghost btn-sm" data-goto="1">Edit</button></div>
          <dl>
            <div class="detail-row"><dt>Product</dt><dd>${escapeHtml(draft.product.name)} (${draft.product.id})</dd></div>
            <div class="detail-row"><dt>Serial number</dt><dd>${escapeHtml(d.serialNumber || "—")}</dd></div>
            <div class="detail-row"><dt>Fault</dt><dd>${humanize(d.faultCategory)}</dd></div>
            <div class="detail-row"><dt>Damage</dt><dd>${DAMAGE_TYPES.find((t) => t.value === d.damageType)?.label}</dd></div>
            <div class="detail-row"><dt>Fault date</dt><dd>${formatDate(d.faultDate)}</dd></div>
            <div class="detail-row"><dt>Previous repairs</dt><dd>${(draft.product.repairs || []).length}</dd></div>
          </dl>
          <p style="margin-top:var(--space-3)">${escapeHtml(d.description)}</p>
        </div>
        <div class="card">
          <div class="card__header"><div class="card__title">Documents</div><button class="btn btn-ghost btn-sm" data-goto="2">Edit</button></div>
          ${list(prep.presentDocuments || [], "is-done", "check-circle-2")}
          ${list(prep.missingDocuments || [], "is-pending", "x-circle")}
        </div>
      </div>
      <div>
        <div class="card">
          <div class="card__title" style="margin-bottom:var(--space-4)">Before you submit</div>
          <div style="text-align:center;margin-bottom:var(--space-4)">
            <div class="ring" style="--ring-size:100px;margin:0 auto">
              <svg width="100" height="100" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-subtle)" stroke-width="9"/>
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--color-forest)" stroke-width="9" stroke-linecap="round"
                  stroke-dasharray="${2 * Math.PI * 42}" stroke-dashoffset="${2 * Math.PI * 42 * (1 - readiness / 100)}" transform="rotate(-90 50 50)"/>
              </svg>
              <span class="ring__value">${readiness}%</span>
            </div>
          </div>
          ${prep.missingFields?.length ? `<div class="alert alert--warning" style="margin-bottom:var(--space-3)">${icon("alert-triangle", { size: 18 })}<div><div class="alert__title">Missing information</div>${prep.missingFields.map(escapeHtml).join(", ")}</div></div>` : ""}
          ${prep.missingDocuments?.length ? `<div class="alert alert--warning" style="margin-bottom:var(--space-3)">${icon("file-text", { size: 18 })}<div><div class="alert__title">Required documents not uploaded</div>${prep.missingDocuments.map(escapeHtml).join(", ")}</div></div>` : ""}
          ${prep.deadlines?.length ? `<div class="alert alert--info" style="margin-bottom:var(--space-3)">${icon("clock-3", { size: 18 })}<div><div class="alert__title">Deadlines</div>${prep.deadlines.map(escapeHtml).join("<br>")}</div></div>` : ""}
          ${prep.contradictions?.length ? `<div class="alert alert--danger" style="margin-bottom:var(--space-3)">${icon("alert-triangle", { size: 18 })}<div><div class="alert__title">Possible contradictions</div>${prep.contradictions.map(escapeHtml).join("<br>")}</div></div>` : ""}
          ${prep.actions?.length ? `<div class="card__subtitle" style="margin-bottom:var(--space-2)">Recommended before submitting</div>${list(prep.actions, "is-pending", "chevron-right")}` : ""}
          ${!prep.missingFields?.length && !prep.missingDocuments?.length && !prep.contradictions?.length
            ? `<div class="alert alert--success">${icon("check-circle-2", { size: 18 })}<div><div class="alert__title">Ready to submit</div>Nothing is missing.</div></div>`
            : `<p class="text-xs text-muted" style="margin-top:var(--space-3)">You can still submit — claims with gaps are sent to a reviewer.</p>`}
        </div>
      </div>
    </div>
    ${footer({ next: "Submit claim" })}`;

  panel.querySelectorAll("[data-goto]").forEach((btn) => btn.addEventListener("click", () => { step = Number(btn.dataset.goto); renderStep(); }));
  wireBack();
  document.getElementById("btn-next").addEventListener("click", () => { step = 4; renderStep(); });
}

/* ---------------- Step 5: Result ---------------- */
async function resultStep(panel) {
  panel.innerHTML = `
    <div class="card" style="text-align:center;padding:var(--space-12)">
      <div class="state-block__icon" style="margin:0 auto var(--space-4)">${icon("sparkles", { size: 26 })}</div>
      <h3>Evaluating claim ${draft.claimId}</h3>
      <p>Running the Python model and the Teachable Machine model, then the warranty rules…</p>
    </div>`;
  let claim;
  try {
    claim = await claimService.submitClaim(draft.claimId);
  } catch (err) {
    step = 3;
    showToast(err.message, "error");
    renderStep();
    return;
  }
  panel.innerHTML = `
    <div class="card" style="text-align:center;padding:var(--space-10)">
      <div style="margin-bottom:var(--space-3)">${statusBadge(claim.status)}</div>
      <h3 style="margin-bottom:var(--space-2)">${escapeHtml(claim.decision.result)}</h3>
      <p style="max-width:560px;margin:0 auto var(--space-4)">${escapeHtml(claim.decision.explanation)}</p>
      <p class="text-sm text-muted" style="margin-bottom:var(--space-6)">Python model: ${escapeHtml(claim.analysis.modelOne.prediction)} · Teachable Machine: ${escapeHtml(claim.analysis.modelTwo.prediction)} · ${escapeHtml(claim.analysis.consistency)}</p>
      <button class="btn btn-primary" id="view-claim" type="button">View full claim${icon("chevron-right", { size: 15 })}</button>
    </div>`;
  document.getElementById("view-claim").addEventListener("click", () => navigate(`/claim-details?id=${claim.id}`));
}

function val(id) { return document.getElementById(id)?.value?.trim() || ""; }
function setErr(id, msg) { const f = document.getElementById(id).closest(".field"); f.classList.add("has-error"); f.querySelector(".field__error").textContent = msg; }
function clearErr(id) { document.getElementById(id)?.closest(".field")?.classList.remove("has-error"); }
