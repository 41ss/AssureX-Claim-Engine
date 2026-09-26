"""The shapes passed between modules. Change these only after telling everyone.

    platform  --ClaimFeatures-->  ml.predict / teachable.predict  --ModelPrediction-->
    decision.engine  --DecisionResult-->  platform (saved) --> frontend (shown)
"""
from dataclasses import dataclass, field


@dataclass
class ClaimFeatures:
    """One claim after cleaning (xvi). The same fields go into the CSV row and the summary card."""
    claim_code: str
    product_category: str
    product_age_days: int
    warranty_months: int
    warranty_days_left: int          # negative once expired
    fault_category: str
    days_purchase_to_fault: int
    previous_repairs: int
    product_replaced_before: bool
    physical_damage: bool
    water_damage: bool
    receipt_present: bool
    warranty_card_present: bool
    product_image_present: bool
    repair_report_present: bool
    serial_matches: bool
    missing_documents: int


@dataclass
class ModelPrediction:
    model_name: str                  # "python" | "teachable"
    model_version: str
    label: str                       # one of config.CLAIM_CLASSES
    probabilities: dict[str, float]  # all three classes

    @property
    def confidence(self) -> float:
        return self.probabilities[self.label]


@dataclass
class RuleFinding:
    rule: str
    passed: bool
    severity: str = "info"           # info | warning | blocking
    message: str = ""


@dataclass
class DecisionResult:
    decision: str                    # Likely Valid | Likely Invalid | Manual Review Required
    consistency: str                 # Consistent | Partially Consistent | Inconsistent
    confidence_gap: float
    findings: list[RuleFinding] = field(default_factory=list)
    reasons: list[str] = field(default_factory=list)
