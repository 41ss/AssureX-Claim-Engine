/**
 * statusBadge.js — renders a claim/warranty status as a badge that
 * never relies on color alone (icon + label always included).
 */
import { icon } from "./icons.js";

const STATUS_MAP = {
  approved: { label: "Approved", cls: "badge--approved", iconName: "check-circle-2" },
  rejected: { label: "Rejected", cls: "badge--rejected", iconName: "x-circle" },
  review: { label: "Under Review", cls: "badge--review", iconName: "clock-3" },
  draft: { label: "Draft", cls: "badge--draft", iconName: "file-text" },
  active: { label: "Active", cls: "badge--approved", iconName: "check-circle-2" },
  expiring: { label: "Expiring Soon", cls: "badge--warning", iconName: "alert-triangle" },
  expired: { label: "Expired", cls: "badge--rejected", iconName: "x-circle" },
};

export function statusBadge(statusKey) {
  const cfg = STATUS_MAP[statusKey] || STATUS_MAP.draft;
  return `<span class="badge ${cfg.cls}">${icon(cfg.iconName, { size: 12 })}${cfg.label}</span>`;
}
