/**
 * mobileNav.js — top header + bottom tab bar shown only on phones.
 */
import { icon } from "./icons.js";

const TABS = [
  { key: "dashboard", label: "Home", href: "/dashboard", iconName: "home" },
  { key: "claims", label: "Claims", href: "/claims", iconName: "files" },
  { key: "reports", label: "Reports", href: "/reports", iconName: "bar-chart-3" },
  { key: "settings", label: "Profile", href: "/settings", iconName: "user" },
];

export function renderMobileHeader() {
  return `
    <header class="mobile-header">
      <div class="mobile-header__brand">
        <img src="/static/branding/assurex-mark.svg" alt="">
        <span>ASSUREX</span>
      </div>
      <button class="theme-toggle" type="button" data-theme-toggle aria-label="Switch to dark mode" title="Switch to dark mode"></button>
      <button class="btn-icon" style="color:#fff" aria-label="Notifications">${icon("bell", { size: 18 })}</button>
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
