/**
 * router.js — moves between signed-in pages without reloading the browser.
 *
 * The shell (sidebar, topbar, bottom nav, background X) is rendered once by
 * app.js. Clicking an internal link swaps only <main id="page-content">,
 * updates the address bar, the tab title and the active nav item. Back and
 * forward work through popstate. Every path still has its own Jinja template,
 * so opening or refreshing any URL directly behaves as before.
 */
import { renderSidebar } from "./components/sidebar.js";
import { state } from "./state.js";
import { isStaff } from "./utils/claimOptions.js";

const SUFFIX = " — ASSUREX Claim Engine";

// path -> page key (as used by the nav), tab title, and how to render it.
const ROUTES = {
  "/dashboard": { key: "dashboard", title: "Dashboard", load: () => import("./pages/dashboard.js").then((m) => m.renderDashboardPage) },
  "/new-claim": { key: "new-claim", title: "New Claim", load: () => import("./pages/newClaim.js").then((m) => m.renderNewClaimPage) },
  "/claims": { key: "claims", title: "Claims", load: () => import("./pages/claims.js").then((m) => m.renderClaimsPage) },
  "/claim-details": { key: "claim-details", title: "Claim Details", load: () => import("./pages/claimDetails.js").then((m) => m.renderClaimDetailsPage) },
  "/products": { key: "products", title: "Products & Warranty", load: () => import("./pages/products.js").then((m) => m.renderProductsPage) },
  "/reports": { key: "reports", title: "Reports", load: () => import("./pages/reports.js").then((m) => m.renderReportsPage) },
  "/settings": { key: "settings", title: "Settings", load: () => import("./pages/settings.js").then((m) => m.renderSettingsPage) },
  "/admin-dashboard": { key: "admin-dashboard", title: "Admin Dashboard", load: () => import("./pages/adminDashboard.js").then((m) => m.renderAdminDashboardPage) },
  "/admin-review": { key: "admin-review", title: "Review Queue", load: () => import("./pages/adminReview.js").then((m) => m.renderAdminReviewPage) },
};

let started = false;
let renderToken = 0;

function isAdminNav(key) {
  return isStaff(state.session?.role) || key === "admin-dashboard" || key === "admin-review";
}

function markActive(key, path) {
  // The sidebar shows a different item set on admin pages, so swap it when that changes.
  const sidebar = document.querySelector(".sidebar");
  const showsAdmin = !!sidebar?.querySelector('a[href="/admin-dashboard"]');
  if (sidebar && showsAdmin !== isAdminNav(key)) {
    sidebar.outerHTML = renderSidebar({ activeKey: key, session: state.session });
    document.getElementById("logout-trigger")?.addEventListener("click", () => {
      import("./services/authService.js").then(({ authService }) => {
        authService.logout();
        window.location.href = "/login";
      });
    });
  }
  document.querySelectorAll(".nav-item, .bottom-nav__item").forEach((a) => {
    a.classList.toggle("is-active", a.getAttribute("href") === path);
  });
}

function closeMenus() {
  document.querySelectorAll(".notif-dropdown, .notif-panel").forEach((el) => el.classList.remove("is-open"));
  document.querySelector("[data-mobile-search-form]")?.classList.remove("is-open");
}

async function show(url) {
  const route = ROUTES[url.pathname];
  const content = document.getElementById("page-content");
  if (!route || !content) return false;

  const token = ++renderToken;
  document.title = route.title + SUFFIX;
  markActive(route.key, url.pathname);
  closeMenus();
  window.scrollTo(0, 0);

  const render = await route.load();
  if (token !== renderToken) return true;     // a newer click already won
  content.innerHTML = "";
  render(content, state.session);
  return true;
}

/** Go to an in-app path without a reload; falls back to a normal load for anything else. */
export async function navigate(href, { replace = false } = {}) {
  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin || !ROUTES[url.pathname]) {
    window.location.href = url.href;
    return;
  }
  if (url.href !== window.location.href) {
    history[replace ? "replaceState" : "pushState"]({}, "", url.href);
  }
  await show(url);
}

export function startRouter() {
  if (started) return;
  started = true;

  // Capture phase: some panels stop click propagation before it reaches the document.
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest("a[href]");
    if (!link || link.target || link.hasAttribute("download") || link.getAttribute("href").startsWith("#")) return;
    const url = new URL(link.getAttribute("href"), window.location.href);
    if (url.origin !== window.location.origin || !ROUTES[url.pathname]) return;
    event.preventDefault();
    navigate(url.href);
  }, true);

  window.addEventListener("popstate", () => show(new URL(window.location.href)));
}
