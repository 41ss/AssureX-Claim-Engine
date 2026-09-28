/**
 * fileUpload.js — drag/drop + click-to-browse uploader.
 * Owns: file selection, preview, progress, remove/retry.
 * Does NOT own: OCR, storage, or virus scanning — that's the
 * backend/ML team's responsibility once a real endpoint exists.
 */
import { icon } from "./icons.js";
import { formatFileSize } from "../utils/formatters.js";
import { validateFile } from "../utils/validators.js";
import { claimService } from "../services/claimService.js";
import { showToast } from "./toast.js";

/**
 * mountUploader(container, { docType, claimId, onChange })
 * Renders an uploader + document list inside `container`, and calls
 * onChange(documents[]) whenever the list changes.
 */
export function mountUploader(container, { docType, onChange }) {
  const documents = [];

  container.innerHTML = `
    <div class="uploader" tabindex="0" role="button" aria-label="Upload ${docType}">
      ${icon("upload", { size: 32 })}
      <div class="uploader__title">Drag & drop files here</div>
      <div class="uploader__hint">or click to browse — PDF, JPG, PNG (max 10MB)</div>
      <input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple>
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
  input.addEventListener("change", (e) => handleFiles(e.target.files));

  function renderList() {
    docList.innerHTML = documents
      .map((doc, i) => {
        if (doc.status === "error") {
          return `
            <div class="doc-card is-error">
              <div class="doc-card__icon">${icon("alert-triangle", { size: 17 })}</div>
              <div class="doc-card__body">
                <div class="doc-card__name">${doc.name}</div>
                <div class="doc-card__meta">${doc.error}</div>
              </div>
              <div class="doc-card__actions">
                <button class="btn-icon" data-retry="${i}">${icon("history", { size: 15 })}</button>
                <button class="btn-icon" data-remove="${i}">${icon("trash-2", { size: 15 })}</button>
              </div>
            </div>`;
        }
        return `
          <div class="doc-card">
            <div class="doc-card__icon">${icon("file-text", { size: 17 })}</div>
            <div class="doc-card__body">
              <div class="doc-card__name">${doc.name}</div>
              <div class="doc-card__meta">${formatFileSize(doc.size)} — ${doc.status === "uploading" ? "Uploading…" : "Uploaded"}</div>
              ${doc.status === "uploading" ? `<div class="progress" style="margin-top:6px"><div class="progress__fill" style="width:${doc.progress || 40}%"></div></div>` : ""}
            </div>
            <div class="doc-card__actions">
              <button class="btn-icon" data-remove="${i}">${icon("trash-2", { size: 15 })}</button>
            </div>
          </div>`;
      })
      .join("");

    docList.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.onclick = () => {
        documents.splice(Number(btn.dataset.remove), 1);
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
  }

  async function uploadDoc(doc) {
    try {
      const result = await claimService.uploadDocument(null, doc.file, docType);
      Object.assign(doc, result, { status: "verified" });
    } catch (err) {
      doc.status = "error";
      doc.error = "We couldn't upload this document. Please try again.";
    }
    renderList();
    onChange?.(documents);
  }

  function handleFiles(fileList) {
    Array.from(fileList).forEach((file) => {
      const validation = validateFile(file);
      const doc = { name: file.name, size: file.size, file, status: validation.ok ? "uploading" : "error", error: validation.ok ? null : validation.message };
      documents.push(doc);
      if (!validation.ok) showToast(validation.message, "error");
      renderList();
      if (validation.ok) uploadDoc(doc);
    });
  }

  return { getDocuments: () => documents.filter((d) => d.status === "verified") };
}
