/**
 * navbar.js — topbar: global search, notification bell, date/time.
 */
import { icon } from "./icons.js";

export function renderTopbar({ notifications = [] } = {}) {
  const unreadCount = notifications.filter((n) => n.unread).length;
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  return `
    <header class="topbar">
      <div class="topbar__search">
        <div class="search-input">
          ${icon("search", { size: 16 })}
          <input type="text" id="global-search" placeholder="Search claims, products, customers...">
          <span class="kbd hide-mobile">&#8984; K</span>
        </div>
      </div>
      <div class="topbar__actions">
        <button class="theme-toggle" type="button" data-theme-toggle aria-label="Switch to dark mode" title="Switch to dark mode"></button>
        <div class="dropdown" id="notif-dropdown">
          <button class="btn-icon bell-btn" id="notif-trigger" aria-label="Notifications">
            ${icon("bell", { size: 18 })}
            ${unreadCount > 0 ? `<span class="bell-dot"></span>` : ""}
          </button>
          <div class="notif-panel" id="notif-panel">
            ${notifications.length
              ? notifications.map((n) => `
                <a class="notif-item ${n.unread ? "is-unread" : ""}" href="${n.claimId ? `/claim-details?id=${n.claimId}` : "#"}">
                  <div class="icon-tile">${icon("bell", { size: 14 })}</div>
                  <div>
                    <div class="notif-item__title">${n.title}</div>
                    <div class="text-xs text-muted">${n.body}</div>
                    <div class="notif-item__time">${new Date(n.time).toLocaleString("en-GB")}</div>
                  </div>
                </a>`).join("")
              : `<div class="notif-item">You're all caught up.</div>`}
          </div>
        </div>
        <div class="topbar__meta hide-mobile">
          <div>${dateStr}</div>
          <div>${timeStr}</div>
        </div>
      </div>
    </header>`;
}

export function wireTopbarInteractions() {
  const trigger = document.getElementById("notif-trigger");
  const dropdown = document.getElementById("notif-dropdown");
  if (!trigger || !dropdown) return;
  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("is-open");
    document.getElementById("notif-panel")?.classList.toggle("is-open");
  });
  document.addEventListener("click", () => {
    dropdown.classList.remove("is-open");
    document.getElementById("notif-panel")?.classList.remove("is-open");
  });
}
