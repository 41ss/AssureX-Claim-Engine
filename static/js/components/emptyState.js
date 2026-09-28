import { icon } from "./icons.js";

export function emptyState({ iconName = "files", title, body, actionLabel, actionHref }) {
  return `
    <div class="state-block">
      <div class="state-block__icon">${icon(iconName, { size: 26 })}</div>
      <div class="state-block__title">${title}</div>
      ${body ? `<div class="state-block__body">${body}</div>` : ""}
      ${actionLabel ? `<a class="btn btn-primary" href="${actionHref || "#"}">${actionLabel}</a>` : ""}
    </div>`;
}
