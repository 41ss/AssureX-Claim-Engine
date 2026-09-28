/**
 * authService.js — login/session concerns only.
 * Real authentication (password hashing, tokens, sessions) belongs
 * to the platform/backend team. The frontend collects credentials
 * and stores whatever session info the backend returns.
 */

import { USE_MOCK_DATA, request, mockResolve, mockReject } from "./api.js";
import { findUserByEmail } from "../mock/users.js";
import { storage } from "../utils/storage.js";

export const authService = {
  async login(email, password) {
    if (USE_MOCK_DATA) {
      const user = findUserByEmail(email);
      if (!user || user.password !== password) {
        return mockReject("Incorrect email or password. Please try again.");
      }
      const session = { id: user.id, name: user.name, email: user.email, role: user.role, avatarInitials: user.avatarInitials };
      return mockResolve(session);
    }
    // TODO: Replace with confirmed backend endpoint.
    return request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  },

  logout() {
    storage.remove("session");
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

  requireRole(role, redirectTo = "/dashboard") {
    const session = this.getSession();
    if (!session || session.role !== role) {
      window.location.href = redirectTo;
      return null;
    }
    return session;
  },
};
