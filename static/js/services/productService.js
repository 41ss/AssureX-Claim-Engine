/**
 * productService.js — registered products & warranty records.
 * The platform team owns registration and expiry calculation logic;
 * the frontend only displays what it returns.
 */

import { USE_MOCK_DATA, request, mockResolve } from "./api.js";
import { MOCK_PRODUCTS, getProductById } from "../mock/products.js";

export const productService = {
  async getProducts(filters = {}) {
    if (USE_MOCK_DATA) {
      let results = [...MOCK_PRODUCTS];
      if (filters.search) {
        const q = filters.search.toLowerCase();
        results = results.filter((p) => p.name.toLowerCase().includes(q) || p.serialNumber.toLowerCase().includes(q));
      }
      return mockResolve(results);
    }
    // TODO: Replace with confirmed backend endpoint.
    return request("/products");
  },

  async getProduct(id) {
    if (USE_MOCK_DATA) return mockResolve(getProductById(id) || null);
    // TODO: Replace with confirmed backend endpoint.
    return request(`/products/${id}`);
  },

  async registerProduct(data) {
    if (USE_MOCK_DATA) {
      const product = { id: `PRD-${2000 + MOCK_PRODUCTS.length + 1}`, claimHistory: [], ...data };
      MOCK_PRODUCTS.unshift(product);
      return mockResolve(product);
    }
    // TODO: Replace with confirmed backend endpoint.
    return request("/products", { method: "POST", body: JSON.stringify(data) });
  },
};
