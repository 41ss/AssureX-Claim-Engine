/**
 * pages/settings.js — Profile / Appearance / Notifications / Account.
 * No backend account-management logic here — this only demonstrates
 * the UI shell the platform team's settings endpoints will fill.
 */
import { icon } from "../components/icons.js";
import { showToast } from "../components/toast.js";
import { applyTheme } from "../components/theme.js";
import { initials } from "../utils/formatters.js";

export function renderSettingsPage(container, session) {
  container.innerHTML = `
    <div class="page-header"><div><h2>Settings</h2><p class="text-sm">Manage your profile, appearance and notification preferences.</p></div></div>

    <div class="tabs">
      <button class="tab is-active" data-tab="profile">Profile</button>
      <button class="tab" data-tab="appearance">Appearance</button>
      <button class="tab" data-tab="notifications">Notifications</button>
      <button class="tab" data-tab="account">Account</button>
    </div>

    <div id="tab-profile" class="card" style="max-width:520px">
      <div style="display:flex;align-items:center;gap:var(--space-4);margin-bottom:var(--space-6)">
        <div class="avatar" style="width:56px;height:56px;font-size:var(--fs-lg)">${initials(session.name)}</div>
        <div><button class="btn btn-secondary btn-sm">Change photo</button></div>
      </div>
      <div class="form-row">
        <div class="field"><label class="field__label">Full name</label><input class="input" value="${session.name}"></div>
        <div class="field"><label class="field__label">Role</label><input class="input" value="${session.role === "admin" ? "Reviewer / Admin" : "Frontend Developer"}" disabled></div>
      </div>
      <div class="field"><label class="field__label">Email address</label><input class="input" type="email" value="${session.email}"></div>
      <div class="field"><label class="field__label">Phone <span class="optional">(optional)</span></label><input class="input" type="tel" placeholder="+254 7XX XXX XXX"></div>
      <button class="btn btn-primary" id="save-profile">Save changes</button>
    </div>

    <div id="tab-appearance" class="card" style="display:none;max-width:520px">
      <div class="field__label" style="margin-bottom:var(--space-3)">Theme</div>
      <div style="display:flex;gap:var(--space-3)">
        <button class="btn btn-secondary" style="flex:1" id="theme-light">Light</button>
        <button class="btn btn-secondary" style="flex:1" id="theme-dark">Dark</button>
      </div>
    </div>

    <div id="tab-notifications" class="card" style="display:none;max-width:520px">
      <label class="checkbox-row" style="margin-bottom:var(--space-4)"><input type="checkbox" checked>Email me when a claim decision is ready</label>
      <label class="checkbox-row" style="margin-bottom:var(--space-4)"><input type="checkbox" checked>Email me about warranty expiry</label>
      <label class="checkbox-row" style="margin-bottom:var(--space-4)"><input type="checkbox">SMS alerts for urgent claim updates</label>
      <button class="btn btn-primary" id="save-notifs">Save preferences</button>
    </div>

    <div id="tab-account" class="card" style="display:none;max-width:520px">
      <div class="field__label" style="margin-bottom:var(--space-2)">Change password</div>
      <div class="field"><input class="input" type="password" placeholder="Current password"></div>
      <div class="field"><input class="input" type="password" placeholder="New password"></div>
      <button class="btn btn-primary" style="margin-bottom:var(--space-6)">Update password</button>
      <div class="alert alert--danger">${icon("alert-triangle", { size: 18 })}<div><div class="alert__title">Danger zone</div>Account deletion isn't available in this demo.</div></div>
    </div>
  `;

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      ["profile", "appearance", "notifications", "account"].forEach((name) => {
        document.getElementById(`tab-${name}`).style.display = name === tab.dataset.tab ? "" : "none";
      });
    });
  });

  document.getElementById("save-profile")?.addEventListener("click", () => showToast("Profile changes saved.", "success"));
  document.getElementById("save-notifs")?.addEventListener("click", () => showToast("Notification preferences saved.", "success"));
  document.getElementById("theme-light")?.addEventListener("click", () => applyTheme("light"));
  document.getElementById("theme-dark")?.addEventListener("click", () => applyTheme("dark"));
}
