"""Cleaning and derived fields (xvi): turns a saved claim into ClaimFeatures. Owner: Victor."""
from src.core.contracts import ClaimFeatures


def build_features(claim, product, documents, repairs) -> ClaimFeatures:
    raise NotImplementedError("ml.features: not built yet (Victor)")
