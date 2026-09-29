/**
 * productService.js — registered products, warranties and repair history.
 * Endpoints live in src/platform/products.py.
 */
import { request } from "./api.js";

export const productService = {
  async getProducts(filters = {}) {
    const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v && v !== "all")).toString();
    return request(`/products?${query}`);
  },

  async getProduct(id) {
    return request(`/products/${id}`);
  },

  /** Registers a product with its warranty (and optional extended warranty) (SRS iii, iv). */
  async registerProduct(data) {
    return request("/products", { method: "POST", body: JSON.stringify(data) });
  },

  /** Adds one repair record to a product (SRS xiii). */
  async addRepair(productId, repair) {
    return request(`/products/${productId}/repairs`, { method: "POST", body: JSON.stringify(repair) });
  },
};
