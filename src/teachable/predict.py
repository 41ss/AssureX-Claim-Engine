"""Google Teachable Machine classification of a Claim Summary Card (SRS xxi).

The model is the Keras export from Teachable Machine, placed in model/teachable_<version>/
(keras_model.h5 + labels.txt). It runs independently of the Python model: its only input
is the card image.
"""
from pathlib import Path

import numpy as np
from PIL import Image

from src.core.config import CLAIM_CLASSES, MODEL_DIR, TEACHABLE_MODEL_VERSION
from src.core.contracts import ModelPrediction

MODEL_VERSION = TEACHABLE_MODEL_VERSION
TM_MODEL_DIR = MODEL_DIR / f"teachable_{MODEL_VERSION}"
INPUT_SIZE = 224          # Teachable Machine image models take 224x224 RGB

_MODEL = None
_LABELS = None


class TeachableModelUnavailable(RuntimeError):
    """The exported Teachable Machine model is missing or cannot be loaded."""


def read_labels(labels_file: Path) -> list[str]:
    """Reads labels.txt ("0 Valid Claim" per line) and maps each entry to a claim class.

    Teachable Machine shortens long class names in the export ("Invalid Clai..."), so each
    entry is matched to the claim class that starts with it.
    """
    labels = []
    for line in labels_file.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        name = line.split(" ", 1)[1].strip().removesuffix("...")
        matches = [c for c in CLAIM_CLASSES if c.startswith(name)]
        if len(matches) != 1:
            raise TeachableModelUnavailable(f"labels.txt entry '{line}' does not match a claim class.")
        labels.append(matches[0])
    return labels


def get_model():
    """Loads the Keras model and its labels once."""
    global _MODEL, _LABELS
    if _MODEL is None:
        model_file = TM_MODEL_DIR / "keras_model.h5"
        labels_file = TM_MODEL_DIR / "labels.txt"
        if not model_file.exists() or not labels_file.exists():
            raise TeachableModelUnavailable(f"Teachable Machine export not found in {TM_MODEL_DIR}.")
        # Teachable Machine exports Keras 2 files; tf_keras reads them under TensorFlow 2.16+.
        import tf_keras
        _MODEL = tf_keras.models.load_model(model_file, compile=False)
        _LABELS = read_labels(labels_file)
        _MODEL.predict(np.zeros((1, INPUT_SIZE, INPUT_SIZE, 3), dtype=np.float32), verbose=0)   # warm-up run
    return _MODEL, _LABELS


def card_to_array(card_path: Path) -> np.ndarray:
    """Resizes the card to 224x224 and scales pixels to [-1, 1], as Teachable Machine does."""
    with Image.open(card_path) as img:
        img = img.convert("RGB").resize((INPUT_SIZE, INPUT_SIZE), Image.Resampling.LANCZOS)
        arr = np.asarray(img, dtype=np.float32) / 127.5 - 1.0
    return np.expand_dims(arr, axis=0)


def predict_card(card_path: Path) -> ModelPrediction:
    """Classifies one Claim Summary Card and returns confidences for all three classes."""
    if not card_path.exists():
        raise FileNotFoundError(f"Card image not found: {card_path}")
    model, labels = get_model()
    scores = model.predict(card_to_array(card_path), verbose=0)[0]
    probabilities = {label: round(float(p), 4) for label, p in zip(labels, scores)}
    best = max(probabilities, key=probabilities.get)
    return ModelPrediction(
        model_name="teachable",
        model_version=MODEL_VERSION,
        label=best,
        probabilities=probabilities,
    )
