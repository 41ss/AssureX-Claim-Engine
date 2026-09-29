/**
 * analysisBlocks.js — the model comparison, rule results and Claim Summary
 * Card blocks, shared by the claim details page and the reviewer screen.
 *
 * Each model predicts a claim class (Valid Claim / Invalid Claim / Manual
 * Review) with a confidence for all three (SRS xix, xxi); the comparison
 * shows whether the classes match and the confidence difference (xxii-xxiv).
 */
import { icon } from "./icons.js";
import { escapeHtml } from "../utils/helpers.js";
import { formatPercent } from "../utils/formatters.js";

function confidenceBars(conf) {
  const rows = [["Valid Claim", conf.valid], ["Invalid Claim", conf.invalid], ["Manual Review", conf.review]];
  return rows.map(([label, value]) => `
    <div class="conf-row">
      <span class="text-xs">${label}</span>
      <div class="progress"><div class="progress__fill" style="width:${Math.round((value || 0) * 100)}%"></div></div>
      <span class="text-xs font-numeric">${formatPercent(value || 0)}</span>
    </div>`).join("");
}

function modelCard(model) {
  return `
    <div class="model-card">
      <div class="model-card__head">
        <strong class="text-sm">${escapeHtml(model.name)}</strong>
        <span class="text-xs text-muted">model ${escapeHtml(model.version)}</span>
      </div>
      <div class="text-sm" style="margin-bottom:6px">Predicted class: <strong>${escapeHtml(model.prediction)}</strong></div>
      ${confidenceBars(model.confidence)}
    </div>`;
}

export function modelComparisonCard(analysis) {
  if (!analysis?.modelOne) {
    return `<div class="card" style="margin-bottom:var(--space-4)"><div class="card__title">Model analysis</div><p class="text-sm text-muted">Not evaluated yet — submit the claim to run both models.</p></div>`;
  }
  return `
    <div class="card" style="margin-bottom:var(--space-4)">
      <div class="card__header"><div class="card__title card__title--icon">${icon("sparkles", { size: 16 })}Model comparison</div></div>
      ${modelCard(analysis.modelOne)}
      <div class="model-vs">vs</div>
      ${modelCard(analysis.modelTwo)}
      <div class="detail-row" style="margin-top:var(--space-3)"><dt>Predicted classes match</dt><dd>${analysis.classesMatch ? "Yes" : "No"}</dd></div>
      <div class="detail-row"><dt>Confidence difference</dt><dd class="font-numeric">${formatPercent(analysis.confidenceDifference, 1)}</dd></div>
      <div class="detail-row"><dt>Model consistency</dt><dd><strong>${escapeHtml(analysis.consistency)}</strong></dd></div>
      <p class="text-xs text-muted" style="margin-top:var(--space-2)">Difference = |Python top-class confidence − Teachable Machine top-class confidence|</p>
    </div>`;
}

export function summaryCardImage(analysis) {
  if (!analysis?.cardUrl) return "";
  return `
    <div class="card claim-summary-card" style="margin-bottom:var(--space-4)">
      <div class="card__header"><div><div class="card__title">Claim Summary Card</div><div class="card__subtitle">Generated from the claim data and read by the Teachable Machine model. It never shows a prediction or decision.</div></div></div>
      <img src="${analysis.cardUrl}" alt="Claim Summary Card" style="width:100%;max-width:448px;display:block;margin:0 auto;border-radius:var(--radius-md)">
    </div>`;
}

/** Rules passed and failed, contradictions and evidence still needed (SRS xxxv). */
export function rulesCard(decision) {
  const rules = decision?.rules || [];
  if (!rules.length && !decision?.contradictions?.length) return "";
  const cls = (r) => (r.passed ? "is-done" : "is-pending");
  const ic = (r) => (r.passed ? "check-circle-2" : r.severity === "blocking" ? "x-circle" : "alert-triangle");
  return `
    <div class="card" style="margin-bottom:var(--space-4)">
      <div class="card__header"><div class="card__title">Warranty rules</div></div>
      ${rules.map((r) => `<div class="check-item ${cls(r)}" title="${escapeHtml(r.rule)}">${icon(ic(r), { size: 16 })}<span>${escapeHtml(r.message)}${r.passed ? "" : ` <span class="text-xs text-muted">(${{ blocking: "fails the claim", review: "needs a reviewer", warning: "warning only" }[r.severity] || "needs a reviewer"})</span>`}</span></div>`).join("")}
      ${decision.evidenceRequired?.length ? `<div class="card__subtitle" style="margin-top:var(--space-3)">Additional evidence required</div>${decision.evidenceRequired.map((e) => `<div class="check-item is-pending">${icon("file-text", { size: 16 })}${escapeHtml(e)}</div>`).join("")}` : ""}
    </div>`;
}
