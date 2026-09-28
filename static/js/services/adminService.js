/**
 * adminService.js — review queue and reviewer actions.
 * Decisioning logic itself belongs to the decision-engine team;
 * this service only fetches what's already decided and forwards
 * reviewer actions (approve / reject / request info) to the backend.
 */

import { USE_MOCK_DATA, request, mockResolve } from "./api.js";
import { MOCK_CLAIMS, getClaimById } from "../mock/claims.js";

export const adminService = {
  async getReviewQueue() {
    if (USE_MOCK_DATA) {
      return mockResolve(MOCK_CLAIMS.filter((c) => c.status === "review"));
    }
    // TODO: Replace with confirmed backend endpoint.
    return request("/admin/review-queue");
  },

  async getClaimReview(id) {
    if (USE_MOCK_DATA) return mockResolve(getClaimById(id) || null);
    // TODO: Replace with confirmed backend endpoint.
    return request(`/admin/review/${id}`);
  },

  async submitReviewerAction(id, action, comment) {
    if (USE_MOCK_DATA) {
      const claim = getClaimById(id);
      if (claim) {
        if (action === "approve") { claim.status = "approved"; claim.stage = "Approved"; }
        if (action === "reject") { claim.status = "rejected"; claim.stage = "Rejected"; }
        if (action === "request_info") { claim.stage = "Additional Information Required"; }
        claim.reviewerComment = comment || null;
      }
      return mockResolve({ ok: true, id, action });
    }
    // TODO: Replace with confirmed backend endpoint.
    return request(`/admin/review/${id}/action`, { method: "POST", body: JSON.stringify({ action, comment }) });
  },
};
