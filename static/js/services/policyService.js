/**
 * policyService.js — the warranty policy for each product category.
 *
 * The backend reads these from policies/*.yaml, so the claim form offers
 * exactly the faults, exclusions and documents the rule engine checks.
 */
import { request } from "./api.js";

let cache = null;

export const policyService = {
  async getPolicies() {
    if (!cache) cache = await request("/policies");
    return cache;
  },

  async getPolicy(category) {
    const policies = await this.getPolicies();
    return policies.find((p) => p.category === category) || null;
  },
};
