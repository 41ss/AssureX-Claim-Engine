from pathlib import Path
import joblib
import pandas as pd

from src.core.config import MODEL_DIR
from src.core.contracts import ClaimFeatures, ModelPrediction

MODEL_PATH = MODEL_DIR / "python_v1.joblib"
_PIPELINE = None


def get_model():
    """Lazy loads serialized pipeline once into memory."""
    global _PIPELINE
    if _PIPELINE is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Model file not found: {MODEL_PATH}. Run scripts/train_model.py first.")
        _PIPELINE = joblib.load(MODEL_PATH)
    return _PIPELINE


def features_to_df(f: ClaimFeatures) -> pd.DataFrame:
    """Converts ClaimFeatures dataclass into single-row DataFrame matching training schema."""
    data = {
        "product_age_days": [f.product_age_days],
        "warranty_months": [f.warranty_months],
        "warranty_days_left": [f.warranty_days_left],
        "days_purchase_to_fault": [f.days_purchase_to_fault],
        "previous_repairs": [f.previous_repairs],
        "missing_documents": [f.missing_documents],
        "product_category": [f.product_category],
        "fault_category": [f.fault_category],
        "product_replaced_before": [int(f.product_replaced_before)],
        "physical_damage": [int(f.physical_damage)],
        "water_damage": [int(f.water_damage)],
        "receipt_present": [int(f.receipt_present)],
        "warranty_card_present": [int(f.warranty_card_present)],
        "product_image_present": [int(f.product_image_present)],
        "repair_report_present": [int(f.repair_report_present)],
        "serial_matches": [int(f.serial_matches)],
    }
    return pd.DataFrame(data)


def predict(features: ClaimFeatures) -> ModelPrediction:
    """Runs Python classification model and returns probabilities for all 3 classes."""
    pipe = get_model()
    df = features_to_df(features)

    probs = pipe.predict_proba(df)[0]
    classes = pipe.classes_

    prob_dict = {cls_name: round(float(prob), 4) for cls_name, prob in zip(classes, probs)}
    best_label = max(prob_dict, key=prob_dict.get)

    return ModelPrediction(
        model_name="python",
        model_version="v1",
        label=best_label,
        probabilities=prob_dict,
    )
