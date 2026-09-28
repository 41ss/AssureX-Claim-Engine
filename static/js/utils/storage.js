/**
 * storage.js
 * Thin wrapper over localStorage/sessionStorage so the rest of the
 * app never touches window.localStorage directly. Swap the backing
 * store here (e.g. for SSR safety) without touching callers.
 */

const PREFIX = "assurex:";

export const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      console.warn("[storage] read failed for", key, err);
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (err) {
      console.warn("[storage] write failed for", key, err);
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch (err) {
      console.warn("[storage] remove failed for", key, err);
    }
  },
};
