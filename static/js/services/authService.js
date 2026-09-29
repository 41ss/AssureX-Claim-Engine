/**
 * authService.js — login, registration, profile and the stored session.
 * The real session is a signed cookie set by src/platform/auth.py; the copy
 * kept here (name, role, initials) only drives what the pages show.
 */
import { request } from "./api.js";
import { storage } from "../utils/storage.js";

export const authService = {
  async login(email, password) {
    return request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  },

  /** Self-registration as customer or service-centre employee (SRS i). */
  async register(data) {
    return request("/auth/register", { method: "POST", body: JSON.stringify(data) });
  },

  logout() {
    storage.remove("session");
    request("/auth/logout", { method: "POST" }).catch(() => {});
  },

  /** Profile update (SRS ii). Returns the updated session. */
  async updateProfile(data) {
    return request("/auth/me", { method: "PUT", body: JSON.stringify(data) });
  },

  async changePassword(currentPassword, newPassword) {
    return request("/auth/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });
  },

  getSession() {
    return storage.get("session", null);
  },

  saveSession(session, remember) {
    storage.set("session", session);
    storage.set("rememberMe", !!remember);
  },

  requireSession(redirectTo = "/login") {
    const session = this.getSession();
    if (!session) {
      window.location.href = redirectTo;
      return null;
    }
    return session;
  },
};
