/**
 * adminService.js — manual-review queue, reviewer actions, alerts,
 * settings and exports for reviewers and administrators.
 * Endpoints live in src/platform/admin.py.
 */
import { request, download } from "./api.js";

export const adminService = {
  async getReviewQueue(filters = {}) {
    return request(`/admin/review-queue?${new URLSearchParams(filters)}`);
  },

  async getClaimReview(id) {
    return request(`/claims/${id}`);
  },

  /** approve | reject | request_info | close | comment (SRS xxxvi, xxxvii). */
  async submitReviewerAction(id, action, comment) {
    return request(`/admin/review/${id}/action`, { method: "POST", body: JSON.stringify({ action, comment }) });
  },

  /** Monitoring and anomaly alerts for administrators (SRS l). */
  async getAlerts() {
    return request("/admin/alerts");
  },

  /** Admin-editable settings: expiry alert days and comparison thresholds (SRS ix, xxiv). */
  async getSettings() {
    return request("/admin/settings");
  },

  async saveSettings(settings) {
    return request("/admin/settings", { method: "PUT", body: JSON.stringify(settings) });
  },

  /** CSV or Excel export of claims, products, warranties or analytics (SRS xlv). */
  async exportData(type, format = "csv") {
    return download(`/admin/export?type=${type}&format=${format}`, `assurex-${type}.${format}`);
  },
};
