/**
 * productService.js — registered products & warranty records.
 * The platform team owns registration and expiry calculation logic;
 * the frontend only displays what it returns.
 */

import { USE_MOCK_DATA, request, mockResolve } from "./api.js";
import { MOCK_PRODUCTS, getProductById } from "../mock/products.js";

const PRODUCTS_STORAGE_KEY = "assurex:mock-products";

function mockProducts() {
  try {
    const stored = JSON.parse(localStorage.getItem(PRODUCTS_STORAGE_KEY) || "null");
    return Array.isArray(stored) ? stored : [...MOCK_PRODUCTS];
  } catch (err) {
    return [...MOCK_PRODUCTS];
  }
}

function saveMockProducts(products) {
  try { localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products)); } catch (err) { /* demo remains usable */ }
}

export const productService = {
  async getProducts(filters = {}) {
    if (USE_MOCK_DATA) {
      let results = mockProducts();
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
    if (USE_MOCK_DATA) return mockResolve(mockProducts().find((product) => product.id === id) || null);
    // TODO: Replace with confirmed backend endpoint.
    return request(`/products/${id}`);
  },

  async registerProduct(data) {
    if (USE_MOCK_DATA) {
      const products = mockProducts();
      const product = { id: `PRD-${2000 + products.length + 1}`, claimHistory: [], ...data };
      products.unshift(product);
      saveMockProducts(products);
      return mockResolve(product);
    }
    // TODO: Replace with confirmed backend endpoint.
    return request("/products", { method: "POST", body: JSON.stringify(data) });
  },
};
