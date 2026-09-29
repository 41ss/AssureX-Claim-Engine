/**
 * statusBadge.js — renders a claim/warranty status as a badge that
 * never relies on color alone (icon + label always included).
 */
import { icon } from "./icons.js";

const STATUS_MAP = {
  // Claim statuses (SRS xxxviii)
  draft: { label: "Draft", cls: "badge--draft", iconName: "file-text" },
  submitted: { label: "Submitted", cls: "badge--review", iconName: "clock-3" },
  evaluating: { label: "Under Evaluation", cls: "badge--review", iconName: "clock-3" },
  info: { label: "Information Required", cls: "badge--warning", iconName: "alert-triangle" },
  review: { label: "Manual Review", cls: "badge--review", iconName: "clock-3" },
  approved: { label: "Approved", cls: "badge--approved", iconName: "check-circle-2" },
  rejected: { label: "Rejected", cls: "badge--rejected", iconName: "x-circle" },
  closed: { label: "Closed", cls: "badge--draft", iconName: "check-circle-2" },
  // Warranty statuses (SRS viii)
  active: { label: "Active", cls: "badge--approved", iconName: "check-circle-2" },
  expiring: { label: "Expiring Soon", cls: "badge--warning", iconName: "alert-triangle" },
  extended: { label: "Extended Warranty", cls: "badge--approved", iconName: "shield-check" },
  expired: { label: "Expired", cls: "badge--rejected", iconName: "x-circle" },
};

export function statusBadge(statusKey) {
  const cfg = STATUS_MAP[statusKey] || STATUS_MAP.draft;
  return `<span class="badge ${cfg.cls}">${icon(cfg.iconName, { size: 12 })}${cfg.label}</span>`;
}
