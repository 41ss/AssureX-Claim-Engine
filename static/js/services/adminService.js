/**
 * adminService.js — review queue and reviewer actions.
 * Decisioning logic itself belongs to the decision-engine team;
 * this service only fetches what's already decided and forwards
 * reviewer actions (approve / reject / request info) to the backend.
 */

import { USE_MOCK_DATA, request, mockResolve } from "./api.js";
import { MOCK_CLAIMS } from "../mock/claims.js";

const CLAIMS_STORAGE_KEY = "assurex:mock-claims";

function mockClaims() {
  try {
    const stored = JSON.parse(localStorage.getItem(CLAIMS_STORAGE_KEY) || "null");
    return Array.isArray(stored) ? stored : [...MOCK_CLAIMS];
  } catch (err) {
    return [...MOCK_CLAIMS];
  }
}

function saveMockClaims(claims) {
  try { localStorage.setItem(CLAIMS_STORAGE_KEY, JSON.stringify(claims)); } catch (err) { /* demo remains usable */ }
}

export const adminService = {
  async getReviewQueue(filters = {}) {
    if (USE_MOCK_DATA) {
      let results = mockClaims().filter((c) => c.status === "review");
      const search = String(filters.search || "").toLowerCase();
      if (search) results = results.filter((c) => `${c.id} ${c.product.name} ${c.faultType}`.toLowerCase().includes(search));
      if (filters.warranty && filters.warranty !== "all") results = results.filter((c) => (c.warranty.active ? "active" : "expired") === filters.warranty);
      if (filters.consistency && filters.consistency !== "all") results = results.filter((c) => c.analysis.consistency === filters.consistency);
      return mockResolve(results);
    }
    // TODO: Replace with confirmed backend endpoint.
    return request("/admin/review-queue");
  },

  async getClaimReview(id) {
    if (USE_MOCK_DATA) return mockResolve(mockClaims().find((claim) => claim.id === id) || null);
    // TODO: Replace with confirmed backend endpoint.
    return request(`/admin/review/${id}`);
  },

  async submitReviewerAction(id, action, comment) {
    if (USE_MOCK_DATA) {
      const claims = mockClaims();
      const claim = claims.find((item) => item.id === id);
      if (claim) {
        if (action === "approve") { claim.status = "approved"; claim.stage = "Approved"; }
        if (action === "reject") { claim.status = "rejected"; claim.stage = "Rejected"; }
        if (action === "request_info") { claim.stage = "Additional Information Required"; }
        claim.reviewerComment = comment || null;
        claim.reviewer = JSON.parse(localStorage.getItem("assurex:session") || "null")?.name || "Administrator";
        claim.reviewedAt = new Date().toISOString();
        claim.auditHistory = [...(claim.auditHistory || []), { action, comment: comment || "", reviewer: claim.reviewer, timestamp: claim.reviewedAt }];
        saveMockClaims(claims);
      }
      return mockResolve({ ok: true, id, action });
    }
    // TODO: Replace with confirmed backend endpoint.
    return request(`/admin/review/${id}/action`, { method: "POST", body: JSON.stringify({ action, comment }) });
  },
};
