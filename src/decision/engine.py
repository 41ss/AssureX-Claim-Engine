"""Model comparison, rule checks and the final decision (xxii-xxxv). Owner: Keagan.

Rules are read from policies/*.yaml and thresholds from config/thresholds.yaml;
nothing is hard-coded here (SRS 1.10.7).
"""
from src.core.contracts import ClaimFeatures, DecisionResult, ModelPrediction


def decide(features: ClaimFeatures, py_pred: ModelPrediction, tm_pred: ModelPrediction) -> DecisionResult:
    raise NotImplementedError("decision.engine: not built yet (Keagan)")
