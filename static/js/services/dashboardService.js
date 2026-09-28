/**
 * dashboardService.js — KPI cards and chart series for both the
 * user dashboard and the admin dashboard.
 */

import { USE_MOCK_DATA, request, mockResolve } from "./api.js";
import {
  MOCK_DASHBOARD_STATS,
  MOCK_ADMIN_STATS,
  MOCK_CLAIMS_TREND,
  MOCK_CLAIMS_BY_PRODUCT,
  MOCK_NOTIFICATIONS,
} from "../mock/dashboard.js";
import { MOCK_CLAIMS } from "../mock/claims.js";

export const dashboardService = {
  async getDashboardStats() {
    if (USE_MOCK_DATA) return mockResolve(MOCK_DASHBOARD_STATS);
    // TODO: Replace with confirmed backend endpoint.
    return request("/dashboard/stats");
  },

  async getAdminStats() {
    if (USE_MOCK_DATA) return mockResolve(MOCK_ADMIN_STATS);
    // TODO: Replace with confirmed backend endpoint.
    return request("/admin/stats");
  },

  async getClaimsTrend(range = "7d") {
    if (USE_MOCK_DATA) return mockResolve(MOCK_CLAIMS_TREND[range] || MOCK_CLAIMS_TREND["7d"]);
    // TODO: Replace with confirmed backend endpoint.
    return request(`/dashboard/trend?range=${range}`);
  },

  async getClaimsByProduct() {
    if (USE_MOCK_DATA) return mockResolve(MOCK_CLAIMS_BY_PRODUCT);
    // TODO: Replace with confirmed backend endpoint.
    return request("/dashboard/by-product");
  },

  async getRecentClaims(limit = 5) {
    if (USE_MOCK_DATA) return mockResolve(MOCK_CLAIMS.slice(0, limit));
    // TODO: Replace with confirmed backend endpoint.
    return request(`/claims?limit=${limit}&sort=-submittedAt`);
  },

  async getNotifications() {
    if (USE_MOCK_DATA) return mockResolve(MOCK_NOTIFICATIONS);
    // TODO: Replace with confirmed backend endpoint.
    return request("/notifications");
  },
};
