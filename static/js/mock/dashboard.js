/**
 * mock/dashboard.js — KPI cards, chart series, and notifications
 * for both the user dashboard and the admin dashboard.
 */

export const MOCK_DASHBOARD_STATS = {
  totalClaims: { value: 1482, deltaPct: 12, direction: "up" },
  approved: { value: 892, deltaPct: 18, direction: "up" },
  rejected: { value: 324, deltaPct: 6, direction: "up" },
  underReview: { value: 266, deltaPct: 9, direction: "up" },
  averageConfidence: 0.85,
};

export const MOCK_ADMIN_STATS = {
  totalClaims: { value: 1482, deltaPct: 12, direction: "up" },
  validClaims: 892,
  invalidClaims: 324,
  manualReviewClaims: 266,
  pendingReview: { value: 266, deltaPct: 9, direction: "up" },
  modelDisagreements: { value: 41, deltaPct: -4, direction: "down" },
  duplicateAlerts: { value: 17, deltaPct: 2, direction: "up" },
  averageConfidence: 0.85,
  approvalRate: 0.60,
  avgProcessingDays: 2.4,
};

/** Claims overview trend — 7 day window, three series. Swap to a
 *  different range by regenerating this shape from the backend. */
export const MOCK_CLAIMS_TREND = {
  "7d": {
    labels: ["21 Sep", "22 Sep", "23 Sep", "24 Sep", "25 Sep", "26 Sep", "27 Sep"],
    approved: [520, 540, 610, 590, 640, 660, 680],
    rejected: [180, 200, 190, 220, 210, 230, 210],
    review: [90, 110, 130, 120, 150, 140, 160],
  },
  "30d": {
    labels: ["W1", "W2", "W3", "W4"],
    approved: [2100, 2350, 2500, 2680],
    rejected: [780, 820, 860, 900],
    review: [410, 460, 500, 540],
  },
  "90d": {
    labels: ["Jul", "Aug", "Sep"],
    approved: [7200, 8100, 8900],
    rejected: [2600, 2800, 3100],
    review: [1400, 1500, 1700],
  },
};

export const MOCK_CLAIMS_BY_PRODUCT = {
  labels: ["Electronics", "Home Appliances", "Vehicles", "Furniture", "Others"],
  values: [560, 410, 240, 160, 112],
};

export const MOCK_NOTIFICATIONS = [
  {
    id: "n1",
    title: "Claim decision ready",
    body: "CLM-0012847 was approved after model review.",
    time: "2026-09-27T08:20:00Z",
    unread: true,
    claimId: "CLM-0012847",
  },
  {
    id: "n2",
    title: "Manual review required",
    body: "CLM-0012846 needs additional review — models disagreed on the outcome.",
    time: "2026-09-27T05:50:00Z",
    unread: true,
    claimId: "CLM-0012846",
  },
  {
    id: "n3",
    title: "Warranty expiring soon",
    body: "Samsung QLED TV warranty expires in 49 days.",
    time: "2026-09-26T09:00:00Z",
    unread: false,
    claimId: null,
  },
  {
    id: "n4",
    title: "Document missing",
    body: "CLM-0012843 is missing a warranty document and serial number evidence.",
    time: "2026-09-24T21:20:00Z",
    unread: false,
    claimId: "CLM-0012843",
  },
];
