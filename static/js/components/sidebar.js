/**
 * sidebar.js — desktop/tablet sidebar navigation.
 * Collapses to icon-only at tablet width via layout.css; hidden
 * entirely on mobile in favour of bottomNav.js.
 */
import { icon } from "./icons.js";

const USER_NAV = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", iconName: "layout-dashboard" },
  { key: "new-claim", label: "New Claim", href: "/new-claim", iconName: "file-plus" },
  { key: "claims", label: "Claims", href: "/claims", iconName: "files" },
  { key: "products", label: "Products & Warranty", href: "/products", iconName: "shield-check" },
  { key: "reports", label: "Reports", href: "/reports", iconName: "bar-chart-3" },
  { key: "settings", label: "Settings", href: "/settings", iconName: "settings" },
];

const ADMIN_NAV = [
  { key: "admin-dashboard", label: "Admin Dashboard", href: "/admin-dashboard", iconName: "layout-dashboard" },
  { key: "admin-review", label: "Review Queue", href: "/admin-review", iconName: "shield-check" },
  { key: "claims", label: "All Claims", href: "/claims", iconName: "files" },
  { key: "products", label: "Products & Warranty", href: "/products", iconName: "package" },
  { key: "reports", label: "Reports", href: "/reports", iconName: "bar-chart-3" },
  { key: "settings", label: "Settings", href: "/settings", iconName: "settings" },
];

function navItemHtml(item, activeKey) {
  const active = item.key === activeKey ? " is-active" : "";
  return `<a class="nav-item${active}" href="${item.href}">${icon(item.iconName, { size: 18 })}<span>${item.label}</span></a>`;
}

export function renderSidebar({ activeKey, session }) {
  const isAdmin = session?.role === "admin" || activeKey === "admin-dashboard" || activeKey === "admin-review";
  const items = isAdmin ? ADMIN_NAV : USER_NAV;
  return `
    <aside class="sidebar">
      <div class="sidebar__brand">
        <img src="/static/branding/assurex-mark.svg" alt="">
        <div>
          <div class="sidebar__brand-name">ASSUREX</div>
          <span class="sidebar__brand-tag">CLAIM ENGINE</span>
        </div>
      </div>
      <nav class="sidebar__nav">
        ${items.map((i) => navItemHtml(i, activeKey)).join("")}
        ${isAdmin ? "" : ""}
      </nav>
      <div class="sidebar__footer">
        <button class="sidebar__user" id="logout-trigger" style="width:100%">
          <div class="avatar avatar--sm">${session?.avatarInitials || "?"}</div>
          <div style="text-align:left">
            <div class="sidebar__user-name">${session?.name || "Guest"}</div>
            <div class="sidebar__user-role">${isAdmin ? "Reviewer / Admin" : "Frontend Developer"}</div>
          </div>
          <span style="margin-left:auto">${icon("log-out", { size: 16 })}</span>
        </button>
      </div>
    </aside>`;
}
