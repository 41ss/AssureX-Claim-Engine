/**
 * state.js — a small, explainable application state object.
 *
 * This is NOT a state-management library. It is a plain object plus
 * a couple of helper functions, kept deliberately simple so it can
 * be explained function-by-function during judging.
 *
 * Shape:
 *   state.session   -> current user session (or null)
 *   state.filters   -> active claims-list filters (the thing judges
 *                      may ask you to extend with a new filter)
 *   state.ui        -> transient UI flags (sidebar open, modal open)
 */

import { authService } from "./services/authService.js";

export const state = {
  session: authService.getSession(),

  // Claims-list filter state. Adding a new filter (the documented
  // "live judging" exercise) means: add a key here, add a control
  // in the claims page markup, and read the key inside
  // claimService.getClaims(). Nothing else needs to change.
  filters: {
    search: "",
    status: "all",
    category: "all",
    warrantyStatus: "all",
    risk: "all",
    confidenceRange: "all",
    consistency: "all",
    reviewer: "all",
    submittedFrom: "",
    submittedTo: "",
  },

  ui: {
    notifPanelOpen: false,
  },
};

/** Reset filters back to defaults — used by the "clear filters" action. */
export function resetFilters() {
  state.filters = {
    search: "",
    status: "all",
    category: "all",
    warrantyStatus: "all",
    risk: "all",
    confidenceRange: "all",
    consistency: "all",
    reviewer: "all",
    submittedFrom: "",
    submittedTo: "",
  };
}
