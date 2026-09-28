/**
 * mock/analysis.js — aggregate model-performance figures shown on
 * the Reports page. These summarise, in demo form, the kind of
 * output the ML and decision-engine teams are expected to return.
 */

export const MOCK_MODEL_PERFORMANCE = {
  pythonModel: {
    version: "v1.4.0",
    accuracy: 0.91,
    precision: 0.89,
    recall: 0.9,
    f1: 0.895,
  },
  teachableMachine: {
    version: "v1.2.0",
    accuracy: 0.87,
    precision: 0.85,
    recall: 0.86,
    f1: 0.855,
  },
  consistencyBreakdown: {
    strongMatch: 62,
    acceptableMatch: 21,
    weakMatch: 9,
    modelDisagreement: 6,
    uncertainResult: 2,
  },
};

export const MOCK_REPORTS = [
  { id: "RPT-001", title: "Weekly claims summary", period: "21–27 Sep 2026", generatedAt: "2026-09-27T06:00:00Z" },
  { id: "RPT-002", title: "Model comparison report", period: "September 2026", generatedAt: "2026-09-25T09:00:00Z" },
  { id: "RPT-003", title: "Warranty expiry forecast", period: "Q4 2026", generatedAt: "2026-09-20T09:00:00Z" },
];
