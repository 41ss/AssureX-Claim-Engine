/**
 * fileUpload.js — drag/drop + click-to-browse uploader for one document type.
 * Owns: file selection, type/size checks, upload progress, remove/retry,
 * and showing the fields OCR read from the file so the user can correct
 * them (SRS vi, vii). OCR itself runs on the backend (src/ml/ocr.py).
 */
import { icon } from "./icons.js";
import { formatFileSize } from "../utils/formatters.js";
import { validateFile } from "../utils/validators.js";
import { escapeHtml } from "../utils/helpers.js";
import { claimService } from "../services/claimService.js";
import { showToast } from "./toast.js";

// Labels for the OCR fields the backend returns.
const FIELD_LABELS = {
  invoice_number: "Invoice number",
  purchase_date: "Purchase date",
  product_name: "Product name",
  model_number: "Model number",
  serial_number: "Serial number",
  retailer: "Retailer",
  purchase_amount: "Purchase amount",
  warranty_months: "Warranty (months)",
};

/**
 * mountUploader(container, { claimId, docType, docLabel, video, onChange })
 * Renders an uploader + document list inside `container`, and calls
 * onChange(documents[]) whenever the list changes.
 */
export function mountUploader(container, { claimId, docType, docLabel, video = false, initial = [], onChange }) {
  const documents = initial.map((d) => ({ ...d, status: "uploaded" }));
  const accept = video ? ".pdf,.jpg,.jpeg,.png,.mp4" : ".pdf,.jpg,.jpeg,.png";

  container.innerHTML = `
    <div class="uploader" tabindex="0" role="button" aria-label="Upload ${docLabel}">
      ${icon("upload", { size: 32 })}
      <div class="uploader__title">Drag & drop files here</div>
      <div class="uploader__hint">or click to browse — PDF, JPG, PNG${video ? ", MP4" : ""} (max ${video ? "50" : "10"}MB)</div>
      <input type="file" accept="${accept}" multiple>
    </div>
    <div class="doc-list"></div>`;

  const dropzone = container.querySelector(".uploader");
  const input = container.querySelector("input[type=file]");
  const docList = container.querySelector(".doc-list");

  dropzone.addEventListener("click", () => input.click());
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") input.click();
  });
  ["dragenter", "dragover"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add("is-dragover");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove("is-dragover");
    })
  );
  dropzone.addEventListener("drop", (e) => handleFiles(e.dataTransfer.files));
  input.addEventListener("change", (e) => { handleFiles(e.target.files); input.value = ""; });

  function extractionHtml(doc, i) {
    const fields = Object.entries(doc.extracted || {});
    if (!fields.length) {
      return doc.ocrMessage ? `<div class="text-xs text-muted" style="margin-top:6px">${escapeHtml(doc.ocrMessage)}</div>` : "";
    }
    return `
      <details class="doc-extraction" ${doc.verifiedAt ? "" : "open"}>
        <summary>${doc.verifiedAt ? "Extracted data — checked" : "Check the data read from this document"}</summary>
        <div class="doc-extraction__grid">
          ${fields.map(([key, value]) => `<label>${FIELD_LABELS[key] || key}<input class="input" data-doc="${i}" data-field="${key}" value="${escapeHtml(value ?? "")}" placeholder="Not found — type it in"></label>`).join("")}
        </div>
        <button class="btn btn-secondary btn-sm" type="button" data-save="${i}" style="margin-top:var(--space-2)">${doc.verifiedAt ? "Save changes" : "Confirm these values"}</button>
      </details>`;
  }

  function renderList() {
    docList.innerHTML = documents
      .map((doc, i) => {
        if (doc.status === "error") {
          return `
            <div class="doc-card is-error">
              <div class="doc-card__icon">${icon("alert-triangle", { size: 17 })}</div>
              <div class="doc-card__body">
                <div class="doc-card__name">${escapeHtml(doc.name)}</div>
                <div class="doc-card__meta">${escapeHtml(doc.error)}</div>
              </div>
              <div class="doc-card__actions">
                ${doc.file ? `<button class="btn-icon" data-retry="${i}" aria-label="Retry">${icon("history", { size: 15 })}</button>` : ""}
                <button class="btn-icon" data-remove="${i}" aria-label="Remove">${icon("trash-2", { size: 15 })}</button>
              </div>
            </div>`;
        }
        return `
          <div class="doc-card">
            <div class="doc-card__icon">${icon("file-text", { size: 17 })}</div>
            <div class="doc-card__body">
              <div class="doc-card__name">${escapeHtml(doc.name)}</div>
              <div class="doc-card__meta">${formatFileSize(doc.size)} — ${doc.status === "uploading" ? "Uploading and reading…" : "Uploaded"}</div>
              ${doc.status === "uploading" ? `<div class="progress" style="margin-top:6px"><div class="progress__fill" style="width:60%"></div></div>` : ""}
              ${doc.duplicateOf ? `<div class="alert alert--warning" style="margin-top:6px">${icon("alert-triangle", { size: 14 })}<div>This exact file was already used on claim ${escapeHtml(doc.duplicateOf)}.</div></div>` : ""}
              ${doc.status === "uploaded" ? extractionHtml(doc, i) : ""}
            </div>
            <div class="doc-card__actions">
              ${doc.id ? `<a class="btn-icon" href="${claimService.documentUrl(claimId, doc.id)}" target="_blank" rel="noopener" aria-label="View">${icon("eye", { size: 15 })}</a>` : ""}
              <button class="btn-icon" data-remove="${i}" aria-label="Remove">${icon("trash-2", { size: 15 })}</button>
            </div>
          </div>`;
      })
      .join("");

    docList.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.onclick = async () => {
        const doc = documents[Number(btn.dataset.remove)];
        if (doc.id) {
          try {
            await claimService.removeDocument(claimId, doc.id);
          } catch (err) {
            showToast(err.message, "error");
            return;
          }
        }
        documents.splice(documents.indexOf(doc), 1);
        renderList();
        onChange?.(documents);
      };
    });
    docList.querySelectorAll("[data-retry]").forEach((btn) => {
      btn.onclick = () => {
        const doc = documents[Number(btn.dataset.retry)];
        doc.status = "uploading";
        renderList();
        uploadDoc(doc);
      };
    });
    docList.querySelectorAll("[data-save]").forEach((btn) => {
      btn.onclick = async () => {
        const i = Number(btn.dataset.save);
        const doc = documents[i];
        const values = {};
        docList.querySelectorAll(`[data-doc="${i}"]`).forEach((field) => { values[field.dataset.field] = field.value.trim(); });
        try {
          const saved = await claimService.verifyDocument(claimId, doc.id, values);
          Object.assign(doc, saved, { status: "uploaded" });
          showToast("Checked values saved.", "success");
          renderList();
          onChange?.(documents);
        } catch (err) {
          showToast(err.message, "error");
        }
      };
    });
  }

  async function uploadDoc(doc) {
    try {
      const result = await claimService.uploadDocument(claimId, doc.file, docType);
      Object.assign(doc, result, { status: "uploaded", file: null });
    } catch (err) {
      doc.status = "error";
      doc.error = err.message || "We couldn't upload this document. Please try again.";
    }
    renderList();
    onChange?.(documents);
  }

  function handleFiles(fileList) {
    Array.from(fileList).forEach((file) => {
      const validation = validateFile(file, { video });
      const doc = { name: file.name, size: file.size, file, status: validation.ok ? "uploading" : "error", error: validation.ok ? null : validation.message };
      documents.push(doc);
      if (!validation.ok) showToast(validation.message, "error");
      renderList();
      if (validation.ok) uploadDoc(doc);
    });
  }

  renderList();
  return { getDocuments: () => documents.filter((d) => d.status === "uploaded") };
}
