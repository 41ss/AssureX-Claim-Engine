/**
 * claimOptions.js — the fixed vocabulary shared with the backend.
 *
 * Product categories match the policy files in policies/*.yaml, document
 * types match Document.doc_type, and the class names match the SRS: each
 * model predicts a claim class, the decision engine returns a final decision.
 */

export const CATEGORIES = [
  { value: "consumer_electronics", label: "Consumer electronics", hint: "Laptops, TVs, monitors, speakers, printers", iconName: "laptop" },
  { value: "mobile_devices", label: "Mobile devices", hint: "Phones, tablets, smartwatches, earbuds", iconName: "smartphone" },
  { value: "small_appliances", label: "Small appliances", hint: "Blenders, kettles, toasters, irons, microwaves", iconName: "washing-machine" },
];

export const DOC_TYPES = {
  receipt: "Purchase receipt / invoice",
  warranty_card: "Warranty card",
  product_image: "Product photo",
  serial_photo: "Serial-number photo",
  fault_evidence: "Fault / damage evidence",
  fault_video: "Fault video",
  diagnostic_report: "Diagnostic report",
  repair_report: "Repair report",
};

export const DAMAGE_TYPES = [
  { value: "none", label: "No physical or liquid damage" },
  { value: "physical", label: "Physical damage (drop, crack, impact)" },
  { value: "water", label: "Water or liquid damage" },
];

// Claim statuses (SRS xxxviii): backend key -> label shown to users.
export const CLAIM_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "evaluating", label: "Under Evaluation" },
  { value: "info", label: "Additional Information Required" },
  { value: "review", label: "Manual Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "closed", label: "Closed" },
];

export const CONSISTENCY_STATUSES = ["Strong Match", "Acceptable Match", "Weak Match", "Model Disagreement", "Uncertain Result"];

/** "charging_port" -> "Charging port" */
export function humanize(key) {
  if (!key) return "—";
  const text = String(key).replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function categoryLabel(value) {
  return CATEGORIES.find((c) => c.value === value)?.label || humanize(value);
}

export function categoryIcon(value) {
  return CATEGORIES.find((c) => c.value === value)?.iconName || "package";
}

export function docTypeLabel(key) {
  return DOC_TYPES[key] || humanize(key);
}

/** Reviewers and administrators can open the review queue. */
export function isStaff(role) {
  return role === "reviewer" || role === "admin";
}
