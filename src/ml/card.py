"""Claim Summary Card images (xx). Must NOT show any prediction or decision. Owner: Victor."""
from pathlib import Path

from src.core.contracts import ClaimFeatures


def render_card(features: ClaimFeatures, variation: int = 0) -> Path:
    """Draw the card for one claim and return the image path. `variation` changes layout/font only."""
    raise NotImplementedError("ml.card: not built yet (Victor)")
