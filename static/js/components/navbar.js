/**
 * navbar.js — topbar: global search, notification bell, date/time.
 */
import { icon } from "./icons.js";

function notificationPanel(notifications, id) {
  return `<div class="notif-panel" id="${id}">
    ${notifications.length
      ? notifications.map((n) => `
        <a class="notif-item ${n.unread ? "is-unread" : ""}" href="${n.claimId ? `/claim-details?id=${n.claimId}` : "#"}">
          <div class="icon-tile">${icon("bell", { size: 14 })}</div>
          <div class="notif-item__body">
            <div class="notif-item__title">${n.title}</div>
            <div class="text-xs text-muted">${n.body}</div>
            <div class="notif-item__time">${new Date(n.time).toLocaleString("en-GB")}</div>
          </div>
          ${n.unread ? '<span class="notif-item__dot" aria-label="Unread"></span>' : ""}
        </a>`).join("")
      : `<div class="notif-item"><div class="notif-item__body"><div class="notif-item__title">You're all caught up</div><div class="text-xs text-muted">No new updates right now.</div></div></div>`}
  </div>`;
}

export function renderTopbar({ notifications = [] } = {}) {
  const unreadCount = notifications.filter((n) => n.unread).length;
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  return `
    <header class="topbar">
      <div class="topbar__search">
        <form class="search-input search-form" data-search-form>
          ${icon("search", { size: 16 })}
          <input type="text" id="global-search" placeholder="Search claims, products, customers...">
          <button class="search-submit" type="submit" aria-label="Search" title="Search">${icon("search", { size: 16 })}</button>
        </form>
      </div>
      <div class="topbar__actions">
        <button class="theme-toggle" type="button" data-theme-toggle aria-label="Switch to dark mode" title="Switch to dark mode"></button>
        <div class="dropdown notif-dropdown" id="notif-dropdown">
          <button class="btn-icon bell-btn" id="notif-trigger" data-notif-trigger aria-label="Notifications">
            ${icon("bell", { size: 18 })}
            ${unreadCount > 0 ? `<span class="bell-dot"></span>` : ""}
          </button>
          ${notificationPanel(notifications, "notif-panel")}
        </div>
        <div class="topbar__meta hide-mobile">
          <div>${dateStr}</div>
          <div>${timeStr}</div>
        </div>
      </div>
    </header>`;
}

export function wireTopbarInteractions() {
  document.querySelectorAll("[data-search-form], [data-mobile-search-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = form.querySelector("input")?.value.trim();
      if (query) window.location.href = `/claims?search=${encodeURIComponent(query)}`;
    });
  });

  document.querySelectorAll("[data-notif-trigger]").forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const dropdown = trigger.closest(".notif-dropdown");
      dropdown?.classList.toggle("is-open");
      dropdown?.querySelector(".notif-panel")?.classList.toggle("is-open");
    });
  });
  document.querySelectorAll(".notif-panel").forEach((panel) => panel.addEventListener("click", (event) => event.stopPropagation()));
  document.addEventListener("click", () => {
    document.querySelectorAll(".notif-dropdown").forEach((dropdown) => dropdown.classList.remove("is-open"));
    document.querySelectorAll(".notif-panel").forEach((panel) => panel.classList.remove("is-open"));
  });
}

export { notificationPanel };
