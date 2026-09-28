/**
 * mobileNav.js — top header + bottom tab bar shown only on phones.
 */
import { icon } from "./icons.js";
import { notificationPanel } from "./navbar.js";

const TABS = [
  { key: "dashboard", label: "Home", href: "/dashboard", iconName: "home" },
  { key: "claims", label: "Claims", href: "/claims", iconName: "files" },
  { key: "reports", label: "Reports", href: "/reports", iconName: "bar-chart-3" },
  { key: "settings", label: "Profile", href: "/settings", iconName: "user" },
];

export function renderMobileHeader(notifications = []) {
  const unreadCount = notifications.filter((n) => n.unread).length;
  return `
    <header class="mobile-header">
      <div class="mobile-header__brand">
        <img src="/static/branding/assurex-mark.svg" alt="">
        <span>ASSUREX</span>
      </div>
      <div class="mobile-header__actions">
        <button class="btn-icon mobile-search-toggle" type="button" data-mobile-search-toggle aria-label="Search" title="Search">${icon("search", { size: 18 })}</button>
        <button class="theme-toggle" type="button" data-theme-toggle aria-label="Switch to dark mode" title="Switch to dark mode"></button>
        <div class="dropdown notif-dropdown mobile-notif-dropdown">
          <button class="btn-icon bell-btn" type="button" data-notif-trigger aria-label="Notifications">
            ${icon("bell", { size: 18 })}
            ${unreadCount > 0 ? `<span class="bell-dot"></span>` : ""}
          </button>
          ${notificationPanel(notifications, "mobile-notif-panel")}
        </div>
      </div>
      <form class="mobile-search search-input search-form" data-mobile-search-form>
        ${icon("search", { size: 16 })}
        <input type="text" placeholder="Search claims or products..." aria-label="Search claims or products">
        <button class="search-submit" type="submit" aria-label="Search" title="Search">${icon("search", { size: 16 })}</button>
      </form>
    </header>`;
}

export function renderBottomNav(activeKey) {
  return `
    <nav class="bottom-nav">
      <ul class="bottom-nav__list">
        ${TABS.map(
          (t) => `<li><a class="bottom-nav__item ${t.key === activeKey ? "is-active" : ""}" href="${t.href}">${icon(t.iconName, { size: 20 })}<span>${t.label}</span></a></li>`
        ).join("")}
      </ul>
    </nav>`;
}
