/**
 * dashboardService.js — KPI cards, chart series and notifications for the
 * user and admin dashboards. Endpoints live in src/platform/dashboard.py
 * and src/platform/admin.py; every number is counted from the database.
 */
import { request } from "./api.js";

export const dashboardService = {
  async getDashboardStats() {
    return request("/dashboard/stats");
  },

  async getAdminStats() {
    return request("/admin/stats");
  },

  async getClaimsTrend(range = "7d") {
    return request(`/dashboard/trend?range=${range}`);
  },

  async getClaimsByProduct() {
    return request("/dashboard/by-product");
  },

  async getRecentClaims(limit = 5) {
    return request(`/claims?limit=${limit}`);
  },

  async getNotifications() {
    return request("/notifications");
  },

  async markNotificationsRead() {
    return request("/notifications/read", { method: "POST" });
  },
};
