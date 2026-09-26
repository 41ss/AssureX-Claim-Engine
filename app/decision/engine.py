"""Model comparison, rule checks and the final decision (xxii-xxxv). Owner: Keagan."""
from app.core.contracts import ClaimFeatures, DecisionResult, ModelPrediction


def decide(features: ClaimFeatures, py_pred: ModelPrediction, tm_pred: ModelPrediction) -> DecisionResult:
    raise NotImplementedError("decision.engine: not built yet (Keagan)")
