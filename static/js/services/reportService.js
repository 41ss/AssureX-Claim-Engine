/**
 * reportService.js — model performance, analytics, report files and the
 * per-claim PDF report. Endpoints live in src/platform/dashboard.py and
 * src/platform/claims.py.
 */
import { request, download } from "./api.js";

export const reportService = {
  async getModelPerformance() {
    return request("/reports/model-performance");
  },

  async getReports() {
    return request("/reports");
  },

  /** Faults, rejection reasons, repairs, expirations, manual-review rate (SRS xliii). */
  async getAnalytics() {
    return request("/reports/analytics");
  },

  /** Downloadable PDF report for one claim (SRS xliv). */
  async downloadClaimReport(id) {
    return download(`/claims/${id}/report`, `${id}-report.pdf`);
  },
};
