/**
 * claimService.js — everything claim-related the UI needs.
 * Pages call these functions; they never fetch() directly.
 * Swap the mock branch for real calls once endpoints are confirmed.
 */

import { USE_MOCK_DATA, request, mockResolve } from "./api.js";
import { MOCK_CLAIMS } from "../mock/claims.js";
import { generateClaimId, wait } from "../utils/helpers.js";

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
  try {
    localStorage.setItem(CLAIMS_STORAGE_KEY, JSON.stringify(claims));
  } catch (err) {
    // Keep the demo usable when storage is unavailable.
  }
}

export const claimService = {
  async getClaims(filters = {}) {
    if (USE_MOCK_DATA) {
      let results = mockClaims();

      if (filters.search) {
        const q = filters.search.toLowerCase();
        results = results.filter(
          (c) =>
            c.id.toLowerCase().includes(q) ||
            c.product.name.toLowerCase().includes(q) ||
            c.product.serialNumber.toLowerCase().includes(q) ||
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
      if (filters.confidenceRange && filters.confidenceRange !== "all") {
        results = results.filter((c) => {
          const confidence = Math.max(c.analysis.modelOne.confidence.valid, c.analysis.modelOne.confidence.invalid, c.analysis.modelOne.confidence.review);
          return filters.confidenceRange === "high" ? confidence >= 0.8 : filters.confidenceRange === "medium" ? confidence >= 0.6 && confidence < 0.8 : confidence < 0.6;
        });
      }
      if (filters.consistency && filters.consistency !== "all") results = results.filter((c) => c.analysis.consistency === filters.consistency);
      if (filters.submittedFrom) results = results.filter((c) => c.submittedAt.slice(0, 10) >= filters.submittedFrom);
      if (filters.submittedTo) results = results.filter((c) => c.submittedAt.slice(0, 10) <= filters.submittedTo);
      return mockResolve(results);
    }
    // TODO: Replace with confirmed backend endpoint.
    const query = new URLSearchParams(filters).toString();
    return request(`/claims?${query}`);
  },

  async getClaim(id) {
    if (USE_MOCK_DATA) {
      return mockResolve(mockClaims().find((claim) => claim.id === id) || null);
    }
    // TODO: Replace with confirmed backend endpoint.
    return request(`/claims/${id}`);
  },

  async createClaim(data) {
    if (USE_MOCK_DATA) {
      const claims = mockClaims();
      const claim = {
        id: generateClaimId(claims.length),
        userId: "USR-1001",
        status: "draft",
        stage: "Draft",
        submittedAt: new Date().toISOString(),
        documents: [],
        analysis: {
          modelOne: { name: "Python Classification Model", version: "v1.4.0", prediction: "Manual Review", confidence: { valid: 0.33, invalid: 0.33, review: 0.34 } },
          modelTwo: { name: "Google Teachable Machine", version: "v1.2.0", prediction: "Manual Review", confidence: { valid: 0.33, invalid: 0.33, review: 0.34 } },
          consistency: "Pending Analysis",
          confidenceDifference: 0,
        },
        decision: {
          result: "Manual Review Required",
          explanation: "Your claim was received and is ready for model and policy review.",
          supportingFactors: [],
          opposingFactors: [],
          contradictions: [],
          missingDocuments: [],
          duplicateWarning: null,
        },
        timeline: [{ label: "Submitted", timestamp: new Date().toISOString(), complete: true }],
        ...data,
      };
      claims.unshift(claim);
      saveMockClaims(claims);
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
      const claims = mockClaims();
      const claim = claims.find((item) => item.id === id);
      if (claim) {
        claim.status = "review";
        claim.stage = "Under Evaluation";
        saveMockClaims(claims);
      }
      return mockResolve({ id, status: "review", stage: "Under Evaluation" });
    }
    // TODO: Replace with confirmed backend endpoint.
    return request(`/claims/${id}/submit`, { method: "POST" });
  },

  async getStatus(id) {
    if (USE_MOCK_DATA) {
      const claim = mockClaims().find((item) => item.id === id);
      return mockResolve(claim ? { status: claim.status, stage: claim.stage, timeline: claim.timeline } : null);
    }
    // TODO: Replace with confirmed backend endpoint.
    return request(`/claims/${id}/status`);
  },

  async getAnalysis(id) {
    if (USE_MOCK_DATA) {
      const claim = mockClaims().find((item) => item.id === id);
      return mockResolve(claim ? claim.analysis : null);
    }
    // TODO: Replace with confirmed backend endpoint.
    return request(`/claims/${id}/analysis`);
  },
};
