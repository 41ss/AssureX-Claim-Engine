/**
 * claimService.js — everything claim-related the UI needs.
 * Pages call these functions; they never fetch() directly.
 * Swap the mock branch for real calls once endpoints are confirmed.
 */

import { USE_MOCK_DATA, request, mockResolve } from "./api.js";
import { MOCK_CLAIMS, getClaimById } from "../mock/claims.js";
import { generateClaimId, wait } from "../utils/helpers.js";

export const claimService = {
  async getClaims(filters = {}) {
    if (USE_MOCK_DATA) {
      let results = [...MOCK_CLAIMS];

      if (filters.search) {
        const q = filters.search.toLowerCase();
        results = results.filter(
          (c) =>
            c.id.toLowerCase().includes(q) ||
            c.product.name.toLowerCase().includes(q) ||
            c.faultType.toLowerCase().includes(q)
        );
      }
      if (filters.status && filters.status !== "all") {
        results = results.filter((c) => c.status === filters.status);
      }
      if (filters.productType && filters.productType !== "all") {
        results = results.filter((c) => c.product.type === filters.productType);
      }
      if (filters.warrantyStatus && filters.warrantyStatus !== "all") {
        const wantActive = filters.warrantyStatus === "active";
        results = results.filter((c) => c.warranty.active === wantActive);
      }
      return mockResolve(results);
    }
    // TODO: Replace with confirmed backend endpoint.
    const query = new URLSearchParams(filters).toString();
    return request(`/claims?${query}`);
  },

  async getClaim(id) {
    if (USE_MOCK_DATA) {
      return mockResolve(getClaimById(id) || null);
    }
    // TODO: Replace with confirmed backend endpoint.
    return request(`/claims/${id}`);
  },

  async createClaim(data) {
    if (USE_MOCK_DATA) {
      const claim = {
        id: generateClaimId(MOCK_CLAIMS.length),
        status: "draft",
        stage: "Draft",
        submittedAt: new Date().toISOString(),
        documents: [],
        ...data,
      };
      MOCK_CLAIMS.unshift(claim);
      return mockResolve(claim);
    }
    // TODO: Replace with confirmed backend endpoint.
    return request("/claims", { method: "POST", body: JSON.stringify(data) });
  },

  async uploadDocument(claimId, file, docType) {
    if (USE_MOCK_DATA) {
      await wait(600);
      return mockResolve({ id: `d-${Date.now()}`, name: file.name, type: docType, size: file.size, status: "verified" });
    }
    // TODO: Replace with confirmed backend endpoint.
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", docType);
    return request(`/claims/${claimId}/documents`, { method: "POST", body: formData, headers: {} });
  },

  async submitClaim(id) {
    if (USE_MOCK_DATA) {
      return mockResolve({ id, status: "review", stage: "Under Evaluation" });
    }
    // TODO: Replace with confirmed backend endpoint.
    return request(`/claims/${id}/submit`, { method: "POST" });
  },

  async getStatus(id) {
    if (USE_MOCK_DATA) {
      const claim = getClaimById(id);
      return mockResolve(claim ? { status: claim.status, stage: claim.stage, timeline: claim.timeline } : null);
    }
    // TODO: Replace with confirmed backend endpoint.
    return request(`/claims/${id}/status`);
  },

  async getAnalysis(id) {
    if (USE_MOCK_DATA) {
      const claim = getClaimById(id);
      return mockResolve(claim ? claim.analysis : null);
    }
    // TODO: Replace with confirmed backend endpoint.
    return request(`/claims/${id}/analysis`);
  },
};
