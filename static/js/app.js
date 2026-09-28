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
    ${renderMobileHeader()}
    ${renderSidebar({ activeKey: activePage, session })}
    <div class="shell-main">
      ${renderTopbar({ notifications })}
      <main class="content" id="page-content"></main>
    </div>
    ${renderBottomNav(activePage)}
  `;

  wireTopbarInteractions();

  document.getElementById("logout-trigger")?.addEventListener("click", () => {
    authService.logout();
    window.location.href = "/login";
  });

  if (state.ui.mockMode) {
    console.info("%cASSUREX running in MOCK MODE — see README.md to connect a real backend.", "color:#145C4A;font-weight:bold");
  }

  return session;
}

/** Convenience accessor used by page scripts once the shell is mounted. */
export function pageContent() {
  return document.getElementById("page-content");
}
