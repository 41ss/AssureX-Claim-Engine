import { icon } from "./icons.js";

/**
 * errorState.js — the ONLY place raw backend errors should be
 * translated into a friendly message. Never render error.message
 * from a caught exception directly to the user; map it here.
 */
export function friendlyError(error) {
  if (!error) return "Something went wrong while connecting to ASSUREX.";
  if (error.status === 404) return "We couldn't find what you were looking for.";
  if (error.status === 401 || error.status === 403) return "You don't have permission to view this.";
  if (error.status >= 500) return "The claim engine is temporarily unavailable. Please try again shortly.";
  return "Something went wrong while connecting to ASSUREX.";
}

export function errorState({ title = "Something went wrong", body, retryLabel = "Try again", onRetry }) {
  const id = `retry-${Math.random().toString(36).slice(2, 8)}`;
  setTimeout(() => {
    const btn = document.getElementById(id);
    if (btn && onRetry) btn.addEventListener("click", onRetry);
  });
  return `
    <div class="state-block">
      <div class="state-block__icon state-block__icon--error">${icon("alert-triangle", { size: 26 })}</div>
      <div class="state-block__title">${title}</div>
      <div class="state-block__body">${body || "Please check your connection and try again."}</div>
      ${onRetry ? `<button class="btn btn-secondary" id="${id}">${retryLabel}</button>` : ""}
    </div>`;
}
