"""Python classification model (xviii, xix). Owner: Victor."""
from app.core.contracts import ClaimFeatures, ModelPrediction


def predict(features: ClaimFeatures) -> ModelPrediction:
    """Load the current model from models/ and return the label plus all three probabilities."""
    raise NotImplementedError("ml.predict: not built yet (Victor)")
