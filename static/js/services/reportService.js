/**
 * reportService.js — analytics + the downloadable claim report.
 */

import { USE_MOCK_DATA, request, mockResolve } from "./api.js";
import { MOCK_MODEL_PERFORMANCE, MOCK_REPORTS } from "../mock/analysis.js";
import { getClaimById } from "../mock/claims.js";

export const reportService = {
  async getModelPerformance() {
    if (USE_MOCK_DATA) return mockResolve(MOCK_MODEL_PERFORMANCE);
    // TODO: Replace with confirmed backend endpoint.
    return request("/reports/model-performance");
  },

  async getReports() {
    if (USE_MOCK_DATA) return mockResolve(MOCK_REPORTS);
    // TODO: Replace with confirmed backend endpoint.
    return request("/reports");
  },

  /**
   * downloadClaimReport(id) — in mock mode, builds a plain-text
   * summary client-side purely so the download button is
   * demonstrable. This is clearly NOT a real generated report;
   * the backend/report-generation team owns the real PDF/CSV output.
   */
  async downloadClaimReport(id) {
    if (USE_MOCK_DATA) {
      const claim = getClaimById(id);
      if (!claim) throw new Error("Claim not found.");
      const lines = [
        `ASSUREX CLAIM ENGINE — MOCK CLAIM REPORT`,
        `(Generated client-side for demonstration only — not a real backend report)`,
        ``,
        `Claim ID: ${claim.id}`,
        `Product: ${claim.product.name} (${claim.product.brand} ${claim.product.model})`,
        `Fault: ${claim.faultType}`,
        `Status: ${claim.status}`,
        `Submitted: ${claim.submittedAt}`,
        ``,
        `Python Model: ${claim.analysis.modelOne.prediction} (${Math.round(claim.analysis.modelOne.confidence.valid * 100)}% valid confidence)`,
        `Teachable Machine: ${claim.analysis.modelTwo.prediction} (${Math.round(claim.analysis.modelTwo.confidence.valid * 100)}% valid confidence)`,
        `Consistency: ${claim.analysis.consistency}`,
        ``,
        `Final Decision: ${claim.decision.result}`,
        `Explanation: ${claim.decision.explanation}`,
      ];
      const blob = new Blob([lines.join("\n")], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${claim.id}-report.txt`;
      a.click();
      URL.revokeObjectURL(url);
      return true;
    }
    // TODO: Replace with confirmed backend endpoint — expected to return a file (PDF/CSV).
    return request(`/claims/${id}/report`);
  },
};
