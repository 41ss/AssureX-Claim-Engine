"""Runs one claim through both models and the decision engine.

The Python model reads the structured features; the Teachable Machine model reads only the
Claim Summary Card image drawn from the same features. Neither sees the other's result.
"""
from src.core.config import CARD_DIR
from src.core.contracts import ClaimFeatures, DecisionResult, ModelPrediction
from src.decision import engine
from src.ml import card, predict as python_model
from src.teachable import predict as teachable_model


def evaluate_claim(
    features: ClaimFeatures,
    extra_contradictions: list[str] | None = None,
    duplicate_indicators: list[str] | None = None,
) -> tuple[ModelPrediction, ModelPrediction, DecisionResult, str]:
    """Returns (Python prediction, Teachable prediction, decision, card image path)."""
    py_pred = python_model.predict(features)
    card_path = card.render_card(features, variation=card.EVALUATION_VARIATION, output_dir=CARD_DIR)
    tm_pred = teachable_model.predict_card(card_path)
    result = engine.decide(features, py_pred, tm_pred, extra_contradictions, duplicate_indicators)
    return py_pred, tm_pred, result, str(card_path)
