/**
 * modal.js — a minimal, reusable confirm/content modal.
 * Usage: openModal({ title, body, confirmLabel, onConfirm })
 */

let overlayEl = null;

function ensureOverlay() {
  if (overlayEl) return overlayEl;
  overlayEl = document.createElement("div");
  overlayEl.className = "modal-overlay";
  overlayEl.innerHTML = `<div class="modal" role="dialog" aria-modal="true"></div>`;
  overlayEl.addEventListener("click", (e) => {
    if (e.target === overlayEl) closeModal();
  });
  document.body.appendChild(overlayEl);
  return overlayEl;
}

export function openModal({ title, body, confirmLabel = "Confirm", cancelLabel = "Cancel", danger = false, onConfirm }) {
  const overlay = ensureOverlay();
  const modal = overlay.querySelector(".modal");
  modal.innerHTML = `
    <div class="modal__header">
      <h3>${title}</h3>
    </div>
    <div class="modal__body">${body}</div>
    <div class="modal__footer">
      <button class="btn btn-secondary" data-action="cancel">${cancelLabel}</button>
      <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-action="confirm">${confirmLabel}</button>
    </div>`;
  modal.querySelector('[data-action="cancel"]').onclick = closeModal;
  modal.querySelector('[data-action="confirm"]').onclick = () => {
    closeModal();
    if (onConfirm) onConfirm();
  };
  requestAnimationFrame(() => overlay.classList.add("is-open"));
}

export function closeModal() {
  if (overlayEl) overlayEl.classList.remove("is-open");
}
