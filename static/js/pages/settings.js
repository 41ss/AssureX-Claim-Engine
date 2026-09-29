/**
 * pages/settings.js — Profile / Appearance / Notifications / Account.
 * No backend account-management logic here — this only demonstrates
 * the UI shell the platform team's settings endpoints will fill.
 */
import { icon } from "../components/icons.js";
import { showToast } from "../components/toast.js";
import { applyTheme } from "../components/theme.js";
import { initials } from "../utils/formatters.js";
import { authService } from "../services/authService.js";
import { storage } from "../utils/storage.js";
import { adminService } from "../services/adminService.js";
import { escapeHtml } from "../utils/helpers.js";

const ROLE_LABELS = { customer: "Customer", service_center: "Service-centre employee", reviewer: "Claim reviewer", admin: "Administrator" };

export function renderSettingsPage(container, session) {
  container.innerHTML = `
    <div class="page-header"><div><h2>Settings</h2><p class="text-sm">Manage your profile, appearance and notification preferences.</p></div></div>

    <div class="tabs">
      <button class="tab is-active" data-tab="profile">Profile</button>
      <button class="tab" data-tab="appearance">Appearance</button>
      <button class="tab" data-tab="notifications">Notifications</button>
      <button class="tab" data-tab="account">Account</button>
      ${session.role === "admin" ? `<button class="tab" data-tab="system">System</button>` : ""}
    </div>

    <div id="tab-profile" class="card" style="max-width:520px">
      <div style="display:flex;align-items:center;gap:var(--space-4);margin-bottom:var(--space-6)">
        <div class="avatar" style="width:56px;height:56px;font-size:var(--fs-lg)">${initials(session.name)}</div>
        <div>
          <button class="btn btn-secondary btn-sm" id="change-photo" type="button">Change photo</button>
          <input id="photo-input" type="file" accept="image/*" hidden>
        </div>
      </div>
      <div class="form-row">
        <div class="field"><label class="field__label" for="profile-name">Full name</label><input class="input" id="profile-name" value="${escapeHtml(session.name)}"></div>
        <div class="field"><label class="field__label">Role</label><input class="input" value="${ROLE_LABELS[session.role] || "Customer"}" disabled></div>
      </div>
      <div class="field"><label class="field__label">User ID</label><input class="input" value="${escapeHtml(session.id)}" disabled></div>
      <div class="field"><label class="field__label" for="profile-email">Email address</label><input class="input" id="profile-email" type="email" value="${session.email}"></div>
      <div class="field"><label class="field__label" for="profile-phone">Phone <span class="optional">(optional)</span></label><input class="input" id="profile-phone" type="tel" value="${session.phone || ""}" placeholder="+254 7XX XXX XXX"></div>
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
      <label class="checkbox-row" style="margin-bottom:var(--space-4)"><input type="checkbox" id="notify-decisions" ${storage.get("notification-preferences", {}).decisions !== false ? "checked" : ""}>Email me when a claim decision is ready</label>
      <label class="checkbox-row" style="margin-bottom:var(--space-4)"><input type="checkbox" id="notify-warranty" ${storage.get("notification-preferences", {}).warranty !== false ? "checked" : ""}>Email me about warranty expiry</label>
      <label class="checkbox-row" style="margin-bottom:var(--space-4)"><input type="checkbox" id="notify-sms" ${storage.get("notification-preferences", {}).sms === true ? "checked" : ""}>SMS alerts for urgent claim updates</label>
      <button class="btn btn-primary" id="save-notifs">Save preferences</button>
    </div>

    <div id="tab-account" class="card" style="display:none;max-width:520px">
      <div class="field__label" style="margin-bottom:var(--space-2)">Change password</div>
      <div class="field"><input class="input" type="password" id="current-password" placeholder="Current password" autocomplete="current-password"></div>
      <div class="field"><input class="input" type="password" id="new-password" placeholder="New password (at least 8 characters)" autocomplete="new-password"></div>
      <button class="btn btn-primary" id="update-password" style="margin-bottom:var(--space-6)">Update password</button>
      <div class="alert alert--danger">${icon("alert-triangle", { size: 18 })}<div><div class="alert__title">Danger zone</div>Account deletion isn't available in this demo.</div></div>
    </div>

    <div id="tab-system" class="card" style="display:none;max-width:620px">
      <div class="card__header"><div><div class="card__title">Alerts and model comparison</div><div class="card__subtitle">Saved to config/thresholds.yaml and used for every new evaluation.</div></div></div>
      <div id="system-settings"><p class="text-sm text-muted">Loading…</p></div>
    </div>
  `;

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      ["profile", "appearance", "notifications", "account", "system"].forEach((name) => {
        const el = document.getElementById(`tab-${name}`);
        if (el) el.style.display = name === tab.dataset.tab ? "" : "none";
      });
      if (tab.dataset.tab === "system") loadSystemSettings();
    });
  });

  document.getElementById("save-profile")?.addEventListener("click", async () => {
    try {
      const updated = await authService.updateProfile({
        name: document.getElementById("profile-name").value.trim(),
        email: document.getElementById("profile-email").value.trim(),
        phone: document.getElementById("profile-phone").value.trim(),
      });
      authService.saveSession(updated, true);
      showToast("Profile changes saved.", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  });
  document.getElementById("update-password")?.addEventListener("click", async () => {
    try {
      await authService.changePassword(document.getElementById("current-password").value, document.getElementById("new-password").value);
      document.getElementById("current-password").value = "";
      document.getElementById("new-password").value = "";
      showToast("Password updated.", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  });
  document.getElementById("change-photo")?.addEventListener("click", () => document.getElementById("photo-input")?.click());
  document.getElementById("photo-input")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Please choose an image file.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const avatar = document.querySelector("#tab-profile .avatar");
      if (avatar) {
        avatar.textContent = "";
        avatar.style.backgroundImage = `url(${reader.result})`;
        avatar.style.backgroundSize = "cover";
        avatar.style.backgroundPosition = "center";
      }
      showToast("Profile photo updated.", "success");
    };
    reader.readAsDataURL(file);
  });
  document.getElementById("save-notifs")?.addEventListener("click", () => {
    storage.set("notification-preferences", { decisions: document.getElementById("notify-decisions").checked, warranty: document.getElementById("notify-warranty").checked, sms: document.getElementById("notify-sms").checked });
    showToast("Notification preferences saved.", "success");
  });
  document.getElementById("theme-light")?.addEventListener("click", () => applyTheme("light"));
  document.getElementById("theme-dark")?.addEventListener("click", () => applyTheme("dark"));
}

/** Administrator settings (SRS ix, xxiv): alert days and comparison thresholds. */
async function loadSystemSettings() {
  const slot = document.getElementById("system-settings");
  try {
    const cfg = await adminService.getSettings();
    const num = (id, label, value, step, hint) => `<div class="field"><label class="field__label" for="${id}">${label}</label><input class="input" type="number" step="${step}" min="0" id="${id}" value="${value}"><div class="text-xs text-muted">${hint}</div></div>`;
    slot.innerHTML = `
      ${num("cfg-alert-days", "Warranty expiry alert (days before expiry)", cfg.warrantyExpiryAlertDays, 1, "Users are notified this many days before a warranty ends.")}
      ${num("cfg-min-conf", "Minimum confidence", cfg.minConfidence, 0.01, "Below this for either model: Uncertain Result.")}
      <div class="form-row">
        ${num("cfg-strong-diff", "Strong Match: max difference", cfg.strongMatch.maxDifference, 0.01, "")}
        ${num("cfg-strong-conf", "Strong Match: min confidence", cfg.strongMatch.minTopConfidence, 0.01, "")}
      </div>
      <div class="form-row">
        ${num("cfg-accept-diff", "Acceptable Match: max difference", cfg.acceptableMatch.maxDifference, 0.01, "")}
        ${num("cfg-accept-conf", "Acceptable Match: min confidence", cfg.acceptableMatch.minTopConfidence, 0.01, "")}
      </div>
      <button class="btn btn-primary" id="save-system">Save settings</button>`;
    document.getElementById("save-system").addEventListener("click", async () => {
      const v = (id) => Number(document.getElementById(id).value);
      try {
        await adminService.saveSettings({
          warrantyExpiryAlertDays: v("cfg-alert-days"),
          minConfidence: v("cfg-min-conf"),
          strongMatch: { maxDifference: v("cfg-strong-diff"), minTopConfidence: v("cfg-strong-conf") },
          acceptableMatch: { maxDifference: v("cfg-accept-diff"), minTopConfidence: v("cfg-accept-conf") },
        });
        showToast("Settings saved.", "success");
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  } catch (err) {
    slot.innerHTML = `<p class="text-sm">${escapeHtml(err.message)}</p>`;
  }
}
