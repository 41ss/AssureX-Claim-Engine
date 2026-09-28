"""Runs one claim through both models and the decision engine."""
from src.core.contracts import ClaimFeatures, DecisionResult, ModelPrediction
from src.decision import engine
from src.ml import card, predict as python_model
from src.teachable import predict as teachable_model


def evaluate_claim(features: ClaimFeatures) -> tuple[ModelPrediction, ModelPrediction, DecisionResult]:
    py_pred = python_model.predict(features)
    card_path = card.render_card(features)
    tm_pred = teachable_model.predict_card(card_path)
    result = engine.decide(features, py_pred, tm_pred)
    return py_pred, tm_pred, result
