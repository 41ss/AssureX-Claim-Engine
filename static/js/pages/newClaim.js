/**
 * pages/newClaim.js — the 5-step new-claim flow.
 * Steps: Product -> Claim Details -> Documents -> Review -> Submit.
 * This page only collects and displays information; it does not
 * decide claim validity — that decision comes back from the
 * decision-engine module once connected.
 */
import { icon, productTypeIcon } from "../components/icons.js";
import { mountUploader } from "../components/fileUpload.js";
import { claimService } from "../services/claimService.js";
import { showToast } from "../components/toast.js";
import { isRequired, isNotFutureDate, isValidDate } from "../utils/validators.js";
import { wait, generateClaimId } from "../utils/helpers.js";
import { MOCK_CLAIMS } from "../mock/claims.js";

const STEPS = ["Product", "Claim Details", "Documents", "Review", "Submit"];
const PRODUCT_TYPES = [
  { value: "laptop", label: "Laptop", iconName: "laptop" },
  { value: "phone", label: "Phone / Audio", iconName: "smartphone" },
  { value: "appliance", label: "Appliance", iconName: "washing-machine" },
  { value: "vehicle", label: "Vehicle", iconName: "car" },
  { value: "camera", label: "Camera", iconName: "scan-search" },
  { value: "other", label: "Other", iconName: "package" },
];
const DOC_CATEGORIES = [
  { key: "receipt", label: "Purchase Receipt" },
  { key: "warranty", label: "Warranty Document" },
  { key: "photo", label: "Product Photo" },
  { key: "evidence", label: "Additional Evidence" },
];

let step = 0;
let container;
const draft = {
  product: { type: "", name: "", brand: "", model: "", serialNumber: "", purchaseDate: "", purchasePrice: "", warrantyProvider: "", warrantyStart: "", warrantyExpiry: "" },
  details: { issueDescription: "", incidentDate: "", damageType: "", notes: "" },
  documents: {},
};

export function renderNewClaimPage(root) {
  container = root;
  step = 0;
  container.innerHTML = `
    <div class="page-header"><div><h2>New Claim</h2><p class="text-sm">Complete each step — you can always come back and edit before submitting.</p></div></div>
    <div class="stepper" id="stepper"></div>
    <div class="step-panel" id="step-panel"></div>
  `;
  renderStepper();
  renderStep();
}

function renderStepper() {
  const el = document.getElementById("stepper");
  el.innerHTML = STEPS.map((label, i) => {
    const cls = i < step ? "is-done" : i === step ? "is-active" : "";
    return `
      <div class="stepper__step ${cls}">
        <div class="stepper__num">${i < step ? icon("check-circle-2", { size: 14 }) : String(i + 1).padStart(2, "0")}</div>
        <span>${label}</span>
      </div>
      ${i < STEPS.length - 1 ? '<div class="stepper__line"></div>' : ""}`;
  }).join("");
}

function renderStep() {
  renderStepper();
  const panel = document.getElementById("step-panel");
  if (step === 0) panel.innerHTML = productStepHtml();
  else if (step === 1) panel.innerHTML = detailsStepHtml();
  else if (step === 2) panel.innerHTML = documentsStepHtml();
  else if (step === 3) panel.innerHTML = reviewStepHtml();
  else panel.innerHTML = submitStepHtml();

  wireStep();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------------- Step 1: Product ---------------- */
function productStepHtml() {
  return `
    <div class="card">
      <div class="card__title" style="margin-bottom:var(--space-4)">What kind of product is this?</div>
      <div class="product-type-grid">
        ${PRODUCT_TYPES.map(
          (t) => `<button type="button" class="product-type-card ${draft.product.type === t.value ? "is-selected" : ""}" data-type="${t.value}">
            ${icon(t.iconName, { size: 22 })}${t.label}
          </button>`
        ).join("")}
      </div>
      <div class="form-row">
        <div class="field"><label class="field__label" for="p-name">Product name</label><input class="input" id="p-name" value="${draft.product.name}" placeholder="e.g. Dell XPS 15"></div>
        <div class="field"><label class="field__label" for="p-brand">Brand</label><input class="input" id="p-brand" value="${draft.product.brand}" placeholder="e.g. Dell"></div>
      </div>
      <div class="form-row">
        <div class="field"><label class="field__label" for="p-model">Model</label><input class="input" id="p-model" value="${draft.product.model}" placeholder="e.g. XPS 15 9530"></div>
        <div class="field"><label class="field__label" for="p-serial">Serial number</label><input class="input" id="p-serial" value="${draft.product.serialNumber}" placeholder="e.g. SN12345678"></div>
      </div>
      <div class="form-row">
        <div class="field"><label class="field__label" for="p-purchase-date">Purchase date</label><input class="input" type="date" id="p-purchase-date" value="${draft.product.purchaseDate}"></div>
        <div class="field"><label class="field__label" for="p-price">Purchase price <span class="optional">(optional)</span></label><input class="input" type="number" id="p-price" value="${draft.product.purchasePrice}" placeholder="KES"></div>
      </div>
      <div class="form-row">
        <div class="field"><label class="field__label" for="p-warranty-provider">Warranty provider</label><input class="input" id="p-warranty-provider" value="${draft.product.warrantyProvider}" placeholder="e.g. Dell Premium Care"></div>
        <div class="field"><label class="field__label" for="p-warranty-expiry">Warranty expiry</label><input class="input" type="date" id="p-warranty-expiry" value="${draft.product.warrantyExpiry}"></div>
      </div>
    </div>
    ${stepFooter()}`;
}

/* ---------------- Step 2: Claim Details ---------------- */
function detailsStepHtml() {
  return `
    <div class="card">
      <div class="field">
        <label class="field__label" for="d-issue">Issue description</label>
        <textarea class="textarea" id="d-issue" placeholder="Describe what happened...">${draft.details.issueDescription}</textarea>
        <div class="field__error"></div>
      </div>
      <div class="form-row">
        <div class="field">
          <label class="field__label" for="d-incident-date">Fault occurrence date</label>
          <input class="input" type="date" id="d-incident-date" value="${draft.details.incidentDate}">
          <div class="field__error"></div>
        </div>
        <div class="field">
          <label class="field__label" for="d-damage-type">Damage type</label>
          <div class="select-wrap">
            <select class="select" id="d-damage-type">
              ${["Screen Damage", "Water Damage", "Power Surge", "Won't Power On", "Battery Issue", "Accidental Damage", "Other"]
                .map((o) => `<option ${draft.details.damageType === o ? "selected" : ""}>${o}</option>`)
                .join("")}
            </select>
          </div>
        </div>
      </div>
      <div class="field">
        <label class="field__label" for="d-notes">Additional notes <span class="optional">(optional)</span></label>
        <textarea class="textarea" id="d-notes" placeholder="Anything else the reviewer should know?">${draft.details.notes}</textarea>
      </div>
    </div>
    ${stepFooter()}`;
}

/* ---------------- Step 3: Documents ---------------- */
function documentsStepHtml() {
  return `
    <div class="card">
      ${DOC_CATEGORIES.map((c) => `
        <div style="margin-bottom:var(--space-6)">
          <div class="field__label" style="margin-bottom:var(--space-2)">${c.label}${c.key !== "evidence" ? "" : ' <span class="optional">(optional)</span>'}</div>
          <div id="uploader-${c.key}"></div>
        </div>`).join("")}
    </div>
    ${stepFooter()}`;
}

/* ---------------- Step 4: Review ---------------- */
function reviewStepHtml() {
  const missing = computeMissing();
  const readiness = computeReadiness();
  return `
    <div class="claim-detail-grid">
      <div>
        <div class="card" style="margin-bottom:var(--space-4)">
          <div class="card__header"><div class="card__title">Product</div><button class="btn btn-ghost btn-sm" data-goto="0">Edit</button></div>
          <dl>
            <div class="detail-row"><dt>Product</dt><dd>${draft.product.name || "—"}</dd></div>
            <div class="detail-row"><dt>Brand / Model</dt><dd>${draft.product.brand || "—"} ${draft.product.model || ""}</dd></div>
            <div class="detail-row"><dt>Serial number</dt><dd>${draft.product.serialNumber || "—"}</dd></div>
            <div class="detail-row"><dt>Purchase date</dt><dd>${draft.product.purchaseDate || "—"}</dd></div>
            <div class="detail-row"><dt>Warranty</dt><dd>${draft.product.warrantyProvider || "—"}</dd></div>
          </dl>
        </div>
        <div class="card" style="margin-bottom:var(--space-4)">
          <div class="card__header"><div class="card__title">Claim Description</div><button class="btn btn-ghost btn-sm" data-goto="1">Edit</button></div>
          <p>${draft.details.issueDescription || "—"}</p>
          <div class="detail-row"><dt>Fault date</dt><dd>${draft.details.incidentDate || "—"}</dd></div>
          <div class="detail-row"><dt>Damage type</dt><dd>${draft.details.damageType || "—"}</dd></div>
        </div>
        <div class="card">
          <div class="card__header"><div class="card__title">Documents</div><button class="btn btn-ghost btn-sm" data-goto="2">Edit</button></div>
          ${DOC_CATEGORIES.map((c) => `<div class="check-item ${draft.documents[c.key]?.length ? "is-done" : "is-pending"}">${icon(draft.documents[c.key]?.length ? "check-circle-2" : "x-circle", { size: 16 })}${c.label}</div>`).join("")}
        </div>
      </div>
      <div>
        <div class="card">
          <div class="card__title" style="margin-bottom:var(--space-4)">Claim Readiness</div>
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
          ${missing.length
            ? `<div class="alert alert--warning">${icon("alert-triangle", { size: 18 })}<div><div class="alert__title">Almost ready</div>Missing: ${missing.join(", ")}.</div></div>`
            : `<div class="alert alert--success">${icon("check-circle-2", { size: 18 })}<div><div class="alert__title">Ready to submit</div>All required information is complete.</div></div>`}
        </div>
      </div>
    </div>
    ${stepFooter({ submitLabel: "Submit Claim" })}`;
}

/* ---------------- Step 5: Submit / processing ---------------- */
function submitStepHtml() {
  return `
    <div class="card" style="text-align:center;padding:var(--space-12)">
      <div class="state-block__icon" style="margin:0 auto var(--space-4)">${icon("sparkles", { size: 26 })}</div>
      <h3>Claim submitted</h3>
      <p style="margin-bottom:var(--space-6)">Preparing your claim for analysis...</p>
      <div class="timeline" style="text-align:left;max-width:360px;margin:0 auto" id="submit-timeline"></div>
    </div>`;
}

/* ---------------- Shared footer + wiring ---------------- */
function stepFooter({ submitLabel } = {}) {
  const isLast = step === STEPS.length - 2; // Review step, next click submits
  return `
    <div class="page-header__actions" style="margin-top:var(--space-6);justify-content:flex-end;display:flex;gap:var(--space-3)">
      ${step > 0 ? `<button class="btn btn-secondary" id="btn-back">${icon("arrow-left", { size: 15 })}Back</button>` : ""}
      <button class="btn btn-primary" id="btn-next">${isLast ? submitLabel || "Submit Claim" : "Continue"}${!isLast ? icon("chevron-right", { size: 15 }) : ""}</button>
    </div>`;
}

function wireStep() {
  document.getElementById("btn-back")?.addEventListener("click", () => { step -= 1; renderStep(); });
  document.querySelectorAll("[data-goto]").forEach((btn) => btn.addEventListener("click", () => { step = Number(btn.dataset.goto); renderStep(); }));

  if (step === 0) {
    document.querySelectorAll("[data-type]").forEach((btn) => {
      btn.addEventListener("click", () => {
        draft.product.type = btn.dataset.type;
        document.querySelectorAll("[data-type]").forEach((b) => b.classList.remove("is-selected"));
        btn.classList.add("is-selected");
      });
    });
    document.getElementById("btn-next").addEventListener("click", () => {
      saveProductFields();
      if (!isRequired(draft.product.name) || !isRequired(draft.product.serialNumber)) {
        showToast("Please fill in the product name and serial number.", "error");
        return;
      }
      step += 1; renderStep();
    });
  }

  if (step === 1) {
    document.getElementById("btn-next").addEventListener("click", () => {
      saveDetailFields();
      let ok = true;
      clearErr("d-issue"); clearErr("d-incident-date");
      if (!isRequired(draft.details.issueDescription)) { setErr("d-issue", "Please describe the issue."); ok = false; }
      if (!isValidDate(draft.details.incidentDate)) { setErr("d-incident-date", "Enter a valid date."); ok = false; }
      else if (!isNotFutureDate(draft.details.incidentDate)) { setErr("d-incident-date", "Date can't be in the future."); ok = false; }
      if (!ok) return;
      step += 1; renderStep();
    });
  }

  if (step === 2) {
    DOC_CATEGORIES.forEach((c) => {
      const el = document.getElementById(`uploader-${c.key}`);
      const controller = mountUploader(el, {
        docType: c.label,
        onChange: (docs) => { draft.documents[c.key] = docs; },
      });
      // Restore any previously uploaded docs when navigating back.
      draft.documents[c.key] = draft.documents[c.key] || [];
    });
    document.getElementById("btn-next").addEventListener("click", () => { step += 1; renderStep(); });
  }

  if (step === 3) {
    document.getElementById("btn-next").addEventListener("click", submitClaim);
  }
}

function saveProductFields() {
  draft.product.name = val("p-name");
  draft.product.brand = val("p-brand");
  draft.product.model = val("p-model");
  draft.product.serialNumber = val("p-serial");
  draft.product.purchaseDate = val("p-purchase-date");
  draft.product.purchasePrice = val("p-price");
  draft.product.warrantyProvider = val("p-warranty-provider");
  draft.product.warrantyExpiry = val("p-warranty-expiry");
}
function saveDetailFields() {
  draft.details.issueDescription = val("d-issue");
  draft.details.incidentDate = val("d-incident-date");
  draft.details.damageType = val("d-damage-type");
  draft.details.notes = val("d-notes");
}
function val(id) { return document.getElementById(id)?.value?.trim() || ""; }
function setErr(id, msg) { const f = document.getElementById(id).closest(".field"); f.classList.add("has-error"); f.querySelector(".field__error").textContent = msg; }
function clearErr(id) { document.getElementById(id)?.closest(".field")?.classList.remove("has-error"); }

function computeMissing() {
  const missing = [];
  if (!draft.product.name) missing.push("product name");
  if (!draft.product.serialNumber) missing.push("serial number");
  if (!draft.documents.receipt?.length) missing.push("purchase receipt");
  if (!draft.documents.warranty?.length) missing.push("warranty document");
  if (!draft.documents.photo?.length) missing.push("product photo");
  return missing;
}
function computeReadiness() {
  const checks = [
    !!draft.product.name,
    !!draft.product.serialNumber,
    !!draft.details.issueDescription,
    !!draft.documents.receipt?.length,
    !!draft.documents.warranty?.length,
    !!draft.documents.photo?.length,
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

async function submitClaim() {
  step += 1;
  renderStep(); // shows the "Claim submitted" panel
  const timelineEl = document.getElementById("submit-timeline");
  const stages = [
    { label: "Claim received", delay: 500 },
    { label: "Documents processed", delay: 900 },
    { label: "Models analysing", delay: 1100 },
    { label: "Decision engine reviewing", delay: 900 },
    { label: "Decision available", delay: 700 },
  ];

  const claim = await claimService.createClaim({
    product: draft.product,
    faultType: draft.details.damageType || "Reported Fault",
    description: draft.details.issueDescription,
    incidentDate: draft.details.incidentDate,
    warranty: { provider: draft.product.warrantyProvider, active: true, expiry: draft.product.warrantyExpiry },
  });

  for (let i = 0; i < stages.length; i += 1) {
    renderTimelineProgress(timelineEl, stages, i);
    // eslint-disable-next-line no-await-in-loop
    await wait(stages[i].delay);
  }
  await claimService.submitClaim(claim.id);
  showToast("Claim submitted successfully.", "success");
  window.location.href = `/claim-details?id=${claim.id}`;
}

function renderTimelineProgress(el, stages, activeIndex) {
  el.innerHTML = stages
    .map((s, i) => {
      const cls = i < activeIndex ? "is-complete" : i === activeIndex ? "is-current" : "";
      return `<div class="timeline__item ${cls}"><div class="timeline__dot"></div><div class="timeline__title">${s.label}</div></div>`;
    })
    .join("");
}
