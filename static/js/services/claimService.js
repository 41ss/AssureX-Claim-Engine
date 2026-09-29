/**
 * claimService.js — claims: list, drafts, documents, preparation check,
 * submission and status. Endpoints live in src/platform/claims.py.
 */
import { request } from "./api.js";

export const claimService = {
  /** Search and filters (SRS xlii); "all" and empty values are left out of the query. */
  async getClaims(filters = {}) {
    const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v && v !== "all")).toString();
    return request(`/claims?${query}`);
  },

  async getClaim(id) {
    return request(`/claims/${id}`);
  },

  /** Saves the claim as a Draft and returns it with its Claim ID (SRS x). */
  async createDraft(data) {
    return request("/claims", { method: "POST", body: JSON.stringify(data) });
  },

  async updateDraft(id, data) {
    return request(`/claims/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  },

  /** Uploads one file; the response carries the OCR fields read from it (SRS vi). */
  async uploadDocument(claimId, file, docType) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("doc_type", docType);
    return request(`/claims/${claimId}/documents`, { method: "POST", body: formData });
  },

  /** Saves the values the user checked or corrected (SRS vii). */
  async verifyDocument(claimId, docId, values) {
    return request(`/claims/${claimId}/documents/${docId}/verified`, { method: "PUT", body: JSON.stringify(values) });
  },

  async removeDocument(claimId, docId) {
    return request(`/claims/${claimId}/documents/${docId}`, { method: "DELETE" });
  },

  documentUrl(claimId, docId) {
    return `/api/claims/${claimId}/documents/${docId}/file`;
  },

  /** Missing information, documents, deadlines and contradictions before submitting (SRS xxxiii). */
  async getPreparation(id) {
    return request(`/claims/${id}/preparation`);
  },

  /** Runs both models and the decision engine; returns the evaluated claim. */
  async submitClaim(id) {
    return request(`/claims/${id}/submit`, { method: "POST" });
  },

  /** Reviewer names for the claims filter (staff only). */
  async getReviewers() {
    return request("/reviewers");
  },
};
