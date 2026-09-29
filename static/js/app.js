/**
 * app.js — shared bootstrap run on every authenticated page.
 *
 * Each authenticated Jinja template includes:
 *   <div id="shell-root" class="app-shell" data-page="dashboard"></div>
 * and loads this module as:
 *   <script type="module" src="/static/js/app.js"></script>
 *
 * initShell() checks the session, and renders the sidebar + topbar +
 * mobile header/bottom nav around whatever page-specific markup the
 * page's own module injects into <main id="page-content">.
 */
import { authService } from "./services/authService.js";
import { dashboardService } from "./services/dashboardService.js";
import { renderSidebar } from "./components/sidebar.js";
import { renderTopbar, wireTopbarInteractions } from "./components/navbar.js";
import { renderMobileHeader, renderBottomNav } from "./components/mobileNav.js";
import { wireThemeToggle } from "./components/theme.js";
import { xmarkSvg } from "./components/xmark.js";
import { startRouter } from "./router.js";
import { state } from "./state.js";

export async function initShell(activePage) {
  const session = authService.requireSession("/login");
  if (!session) return null;
  state.session = session;

  const root = document.getElementById("shell-root");
  if (!root) return session;

  let notifications = [];
  try {
    notifications = await dashboardService.getNotifications();
  } catch (err) {
    notifications = [];
  }

  root.innerHTML = `
    ${renderMobileHeader(notifications)}
    ${renderSidebar({ activeKey: activePage, session })}
    <div class="shell-main">
      ${xmarkSvg("app")}
      ${renderTopbar({ notifications })}
      <main class="content" id="page-content"></main>
    </div>
    ${renderBottomNav(activePage)}
  `;

  wireTopbarInteractions();
  wireThemeToggle();
  startRouter();

  document.querySelector("[data-mobile-search-toggle]")?.addEventListener("click", () => {
    const search = document.querySelector("[data-mobile-search-form]");
    search?.classList.toggle("is-open");
    if (search?.classList.contains("is-open")) search.querySelector("input")?.focus();
  });

  document.getElementById("logout-trigger")?.addEventListener("click", () => {
    authService.logout();
    window.location.href = "/login";
  });

  return session;
}

/** Convenience accessor used by page scripts once the shell is mounted. */
export function pageContent() {
  return document.getElementById("page-content");
}
