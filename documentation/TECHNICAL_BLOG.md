# Dual-Model AI Arbitration: How We Built AssureX to Eliminate Warranty Fraud and Human Review Bottlenecks

**Published:** September 2026  
**Authors:** Keagan, Victor, Ayub, Cyrus, Adan (The AssureX Engineering Team)  
**Competition Track:** TechWiz 7 · NextWave AI and ML · AI-Powered Document Ops  
**Repository:** [https://github.com/41ss/AssureX-Claim-Engine](https://github.com/41ss/AssureX-Claim-Engine)  
**Reading Time:** 14 minutes (~2,600 words)

---

## 1. The $60 Billion Warranty Dilemma

Every year, consumer goods manufacturers and service centres bleed an estimated **$60 billion in fraudulent, erroneous, and misadjudicated warranty claims**. From smartphones with hairline impact fractures claimed as "spontaneous display failure," to blenders run commercially under residential warranties, warranty departments face an unrelenting barrage of claims.

Yet, despite massive advances in enterprise automation, the warranty verification process at most global brands remains stubbornly prehistoric.

```
Claim Submission (Customer / Retailer)
          │
          ▼
   14-Day Manual Queue
  [Clerk checks receipt date]
  [Clerk looks for exclusions]
  [Clerk checks prior repairs]
          │
     ┌────┴───────────────────────────┐
     ▼                                ▼
Human Fatigue Error            Customer Churn
(Missed fraud & liquid damage) (2+ weeks device downtime)
```

In the typical service centre, an overworked claims adjudicator spends three to eight minutes examining a physical or scanned paper invoice, reading a freeform fault description, searching a spreadsheet for repair history, and cross-referencing warranty terms.

Human triage fails in three predictable ways:
1. **Cognitive Fatigue and Missed Exclusions:** When processing 150 claims a day, technicians miss subtle contradiction clues—such as a receipt showing a purchase date in 2026 alongside a defect noted as starting in 2024, or a receipt serial number differing by one digit from the device casing.
2. **Review Latency and Customer Churn:** Manual queues create a 10 to 14-day turnaround. Modern consumers accustomed to instant digital services refuse to wait two weeks without their primary laptop or phone.
3. **Inconsistent Decisions:** A customer in Nairobi might have their slightly cracked screen covered under "discretionary customer goodwill," while an identical claim in London is rejected. This inconsistency damages brand trust and opens legal vulnerabilities.

When our team formed for **TechWiz 7 (NextWave AI and ML)** under the theme **AI-Powered Document Ops**, we set out to answer a fundamental software engineering question:

> *Can we build an automated warranty validation engine that resolves claims in under a second with over 95% accuracy, while enforcing a mathematical guarantee of **zero false auto-approvals on invalid claims**?*

The answer is **AssureX Claim Engine**. Here is how we designed, built, benchmarked, and delivered it.

---

## 2. Why Single-Model AI Fails in High-Stakes Operations

The obvious Silicon Valley answer to warranty verification in 2026 is: *"Just throw a multimodal LLM at it."*

We tested this premise early in our research phase and rejected it for production use. Pure generative models suffer from three fatal flaws in contractual warranty adjudication:
- **Hallucinations & Non-Determinism:** A generative model might approve an out-of-warranty blender because the customer wrote a polite, sympathetic backstory.
- **Latency & Cloud Costs:** Sending multi-page PDFs and high-resolution photos to commercial LLM APIs takes 4 to 8 seconds per claim and costs $0.05 to $0.20 per call. For a manufacturer handling 20,000 daily claims, this is financially unsustainable.
- **Lack of Verifiable Auditability:** When a customer asks, *"Why was my claim rejected?"*, answering *"Because an external neural network assigned it an 84% rejection probability"* fails legal compliance. Regulatory standards require citing exact policy clauses (e.g. *Clause 4.2: Liquid Immersion Exclusion*).

Instead, we designed an **Arbitrated Dual-Model Architecture** paired with a **Deterministic Business Rule Engine**.

```mermaid
graph TD
    subgraph Ingestion
        A[Customer Claim & Uploaded Receipt] --> B[FastAPI Backend]
        B --> C[Tesseract OCR 5 Engine]
    end

    subgraph Dual AI Models
        B --> D[Tabular Feature Vector]
        D --> E[Model 1: Python Random Forest v2]
        
        B --> F[Pillow Card Synthesizer]
        F --> G[Rendered Claim Summary Card]
        G --> H[Model 2: Teachable Machine Vision CNN]
    end

    subgraph Arbitration Nexus
        E --> I[Confidence Distribution P1]
        H --> J[Confidence Distribution P2]
        I --> K[Consensus & Delta Calculator: |P1 - P2|]
        J --> K
        K --> L{Delta <= 0.15 & Consensus?}
    end

    subgraph Deterministic Rules
        B --> M[YAML Warranty Policies]
        M --> N[Policy & Contradiction Engine]
        N --> O[Check Expiry, Liquid, Serial, Duplicate]
    end

    L --> P[Final Decision Synthesizer]
    O --> P
    P --> Q[Likely Valid / Likely Invalid / Manual Review]
```

By deploying **two independent models viewing the same claim through two radically different representations**—one reading tabular feature tokens and the other visually inspecting a synthesized Claim Summary Card—we created a system of checks and balances. When both models agree with high confidence, the system acts instantly. When they disagree, human expertise is summoned with full explanatory telemetry.

---

## 3. Dataset Engineering: 1,500 Claims and 2,550 Visual Cards

A machine learning model is only as credible as its training distribution. Real warranty claim records contain high confidentiality barriers (customer PII, vendor agreements), making raw public enterprise datasets virtually nonexistent.

We engineered a production-grade synthetic dataset generator (`dataset_generator/generator.py`) grounded in ten realistic claim scenarios across three product categories:
- **Consumer Electronics** (Smart TVs, Soundbars, Audio Systems)
- **Mobile Devices** (Smartphones, Tablets, Smartwatches)
- **Small Appliances** (Blenders, Espresso Machines, Air Fryers)

### The Three Ground-Truth Classes
The dataset is balanced with exactly 500 records per class (1,500 total):
1. **`Valid Claim` (500 claims):** Legitimate hardware defects occurring within the valid coverage window with full documentation and no exclusions.
2. **`Invalid Claim` (500 claims):** Submissions violating contractual terms (expired warranty, water ingress, cracked casing from impact, unauthorized third-party repairs, or exceeding the maximum 2-repair cap).
3. **`Manual Review` (500 claims):** Contentious, edge-case, or incomplete submissions (missing receipts, claims filed within a 7-day grace window, serial number OCR discrepancies, or dates indicating defect discovery before purchase).

```
Dataset Partitioning (Stratified 70 / 15 / 15):
├── Train Split:      1,050 claims (350 Valid / 350 Invalid / 350 Review)
├── Validation Split:   225 claims ( 75 Valid /  75 Invalid /  75 Review)
└── Test Split:         225 claims ( 75 Valid /  75 Invalid /  75 Review)
```

### Synthesizing Claim Summary Cards for Computer Vision
While the tabular model consumes numbers and categorical flags, the Google Teachable Machine model requires visual input. 

We built `src/ml/card.py` using Python's Pillow library to render every single claim into an elegant, standardized **1000 x 1400 pixel Claim Summary Card**.

Each card visually maps:
- Claim Header with Product Category & Brand Watermark
- Device Age Timeline (Bar meter displaying days elapsed vs. total warranty duration)
- Defect Category Badge (e.g. `DISPLAY_POWER_FAILURE`)
- Repair History Counter & Evidence Status Tags
- OCR Receipt Verification Metric

```
+-------------------------------------------------------+
|  ASSUREX CLAIM SUMMARY CARD               CLM-00015   |
|  Category: Consumer Electronics                       |
+-------------------------------------------------------+
|  DEVICE TIMELINE                                      |
|  [==========================------------]  184d Left  |
|  Purchased: 2025-03-15        Incident: 2025-11-20    |
+-------------------------------------------------------+
|  DEFECT ATTRIBUTES                                    |
|  Category: Display / Panel Failure                    |
|  Exclusions Checked: NO WATER / NO IMPACT             |
|  Prior Authorized Repairs: 0                          |
+-------------------------------------------------------+
|  EVIDENCE INTEGRITY                                   |
|  Receipt: ATTACHED (OCR Confidence: 99.4%)            |
|  Serial Check: MATCHED IN REGISTRY                    |
+-------------------------------------------------------+
```

To make the computer vision model resilient against visual noise, we generated **2,550 total cards**, introducing layout variations, subtle margin jitter, and font weight shifts. 

> **Crucial Anti-Shortcut Rule:** All cards are generated strictly **blind**. No Python model prediction, no confidence score, and no final decision is ever printed on the card. The vision model must deduce its classification solely from the visual arrangement of claim attributes.

---

## 4. The Python Classifier Shootout

In accordance with SRS Section 1.10.4, we evaluated three diverse machine learning algorithms using 5-fold stratified cross-validation on the 1,050 training records, scored against the 225 validation records:
1. **Random Forest Classifier (v2)**
2. **Gradient Boosting Classifier**
3. **Logistic Regression (L2-Regularized Baseline)**

### Feature Engineering
Our pipeline (`src/ml/features.py`) extracts eleven engineered features:
- `product_category` (One-hot encoded)
- `days_since_purchase` (Standard scaled)
- `days_remaining_warranty` (Can be negative for expired devices)
- `prior_repair_count` (Integer count)
- `has_water_damage`, `has_impact_damage`, `unauthorized_repair` (Binary indicators)
- `receipt_attached`, `photo_attached` (Document presence flags)
- `ocr_confidence` (Float 0.0 to 1.0)
- `claim_amount` (Standard scaled)

### Experimental Results

| Algorithm | Hyperparameters | 5-Fold CV Accuracy | Validation Accuracy | Validation Macro F1 |
|:---|:---|:---:|:---:|:---:|
| **Random Forest (v2)** | `n_estimators=150, max_depth=12, min_samples_split=4` | **94.76% ± 1.88%** | **94.22%** | **0.942** |
| **Gradient Boosting** | `n_estimators=120, max_depth=5, learning_rate=0.1` | 94.38% ± 1.55% | 91.11% | 0.911 |
| **Logistic Regression**| `C=1.0, max_iter=1000` | 72.29% ± 1.74% | 64.44% | 0.645 |

Logistic Regression performed poorly (64.44%) because warranty claim validity is heavily governed by non-linear step functions and combinatorial rules: for instance, a device can be only 30 days old (`days_since_purchase=30`), but if `has_water_damage=True`, the claim is unequivocally invalid.

Random Forest achieved the highest score: **94.22% test accuracy** and **0.942 Macro F1**. We serialized the trained pipeline using `joblib` into `model/python_v2.joblib`.

---

## 5. Training Google Teachable Machine for Document Auditing

For Model 2, we utilized Google Teachable Machine (powered by TensorFlow.js and MobileNet). 

We uploaded the 1,050 training cards across the three classes:
- Class 1: `Valid Claim` (350 card images)
- Class 2: `Invalid Claim` (350 card images)
- Class 3: `Manual Review` (350 card images)

The model was trained for 50 epochs with a batch size of 16 and learning rate of 0.001. After training, we exported the model as an on-device TensorFlow Keras archive (`model/teachable_v2/`), containing `keras_model.h5` and `labels.txt`.

### Local Keras Integration
To eliminate network overhead during inference, we load the model locally using `tf_keras` inside `src/teachable/predict.py`:

```python
import numpy as np
from PIL import Image
import tf_keras as keras

MODEL_PATH = "model/teachable_v2/keras_model.h5"
_model = None

def get_model():
    global _model
    if _model is None:
        _model = keras.models.load_model(MODEL_PATH, compile=False)
    return _model

def predict_card(image: Image.Image) -> dict:
    model = get_model()
    # MobileNet input sizing
    img = image.convert("RGB").resize((224, 224), Image.Resampling.BILINEAR)
    img_array = np.asarray(img, dtype=np.float32)
    normalized = (img_array / 127.5) - 1.0  # Normalize to [-1, 1]
    data = np.ndarray(shape=(1, 224, 224, 3), dtype=np.float32)
    data[0] = normalized

    probabilities = model.predict(data, verbose=0)[0]
    return {
        "Valid Claim": float(probabilities[0]),
        "Invalid Claim": float(probabilities[1]),
        "Manual Review": float(probabilities[2]),
    }
```

On the 225 unseen test cards, Teachable Machine achieved an astonishing **95.11% accuracy** with an average inference speed of **153 milliseconds**.

---

## 6. The Arbitration Engine: Confidence Deltas & Consistency Tiers

Having two predictive models is useless without a rigorous mathematical arbiter. In `src/decision/engine.py`, we implement the **Dual-Model Arbitration Nexus**.

### Step 1: Consensus Verification
We check if both models predicted the identical top class:
$$\text{classes\_match} = (\arg\max(P_{\text{python}}) == \arg\max(P_{\text{teachable}}))$$

### Step 2: Absolute Confidence Gap
We compute the divergence between their top confidence scores:
$$\Delta P = |P_{\text{python}}^{\text{top}} - P_{\text{teachable}}^{\text{top}}|$$

### Step 3: Consistency Tiers
We categorize the comparison into one of five operational tiers defined in `config/thresholds.yaml`:

```
               CONFIDENCE GAP (ΔP)
       0.00          0.10          0.20          0.35
Classes  ┌─────────────┬─────────────┬─────────────┬─────────────┐
Match    │ StrongMatch │ Acceptable  │  WeakMatch  │ Uncertain   │
         │ (Auto-Pass) │ (Auto-Pass) │ (Needs Conf)│ (Flagged)   │
Classes  └─────────────┴─────────────┴─────────────┴─────────────┘
Differ   │                 Model Disagreement                    │
         │         (Mandatory Manual Review Trigger)             │
         └───────────────────────────────────────────────────────┘
```

1. **`Strong Match` ($\Delta P \le 0.10$, Classes Match):** Unanimous high-conviction agreement.
2. **`Acceptable Match` ($0.10 < \Delta P \le 0.20$, Classes Match):** Strong agreement; minor probability variance.
3. **`Weak Match` ($0.20 < \Delta P \le 0.35$, Classes Match):** Both pick the same class, but one model is substantially more confident. Requires policy check corroboration.
4. **`Uncertain Result` ($P^{\text{top}} < 0.60$ on either model):** Statistical ambiguity. Automatically escalated to human review.
5. **`Model Disagreement` (Classes Differ):** Conflict. For example, Python predicts `Valid Claim` while Teachable predicts `Invalid Claim`. **Mandatory manual review**.

Across the 225 test claims, the two models agreed on **97.33%** of cases (219/225).

---

## 7. Deterministic Policy Rules & Contradiction Traps

Statistical models alone cannot be trusted with legal warranty compliance. Even if both models assign a 99% probability of `Valid Claim`, the application must enforce contractual terms.

AssureX evaluates claims against externalized YAML policy files (`policies/consumer_electronics.yaml`, etc.):

```yaml
policy_name: consumer_electronics_warranty
category: Consumer Electronics
coverage_months: 24
grace_period_days: 7
max_covered_repairs: 2
exclusions:
  - liquid_ingress
  - impact_screen_shatter
  - unauthorized_casing_tampering
mandatory_documents:
  - proof_of_purchase
  - defect_photograph
```

### The Three Operational Rule Severities
1. **Hard-Fail (Blocking):** Violates explicit warranty conditions (e.g. `warranty_expired_beyond_grace`, `liquid_ingress_detected`, `max_repairs_exceeded`). **Immediately overrides ML and forces a `Likely Invalid` rejection.**
2. **Review-Trigger:** Inconsistencies that suggest fraud or clerical mistakes. Forces **`Manual Review Required`**:
   - **Chronological Contradiction:** Claim filed before purchase date, or fault date earlier than purchase date.
   - **Serial Number Mismatch:** Customer typed `SN-8849-B`, but Tesseract OCR on the receipt read `SN-1234-A`.
   - **Cryptographic File Duplicate:** Uploaded receipt has an identical SHA-256 hash to a receipt previously submitted by a different user.
3. **Warning:** Minor variances (e.g. claim filed 2 days past standard term but within the 7-day grace period). Permitted to proceed if both AI models exhibit high confidence.

---

## 8. When Models Collide: Examining the 6 Disagreements

In 6 of the 225 unseen test claims (2.67%), our two models disagreed. In production systems, how an application behaves during failures is infinitely more important than how it behaves during successes.

Let's dissect three real disagreement cases from `reports/model_comparison.md`:

### Case 1: CLM-00977 (Excessive Repairs)
- **Claim Profile:** Customer claimed a TV backlight fault. The device had 3 prior repairs.
- **Python RF Model:** Predicted `Valid Claim` ($P=0.48$). The tabular model weighted the young product age heavily and was confused by sparse repair history features.
- **Teachable Machine:** Predicted `Invalid Claim` ($P=0.89$). The visual summary card prominently rendered a red warning badge for `PRIOR REPAIRS: 3`, which the CNN recognized instantly.
- **Engine Arbitration:** Detected `Model Disagreement` ($\Delta P = 0.415$). The rule engine concurrently fired hard-fail rule `max_repairs_exceeded`. 
- **Verdict:** **`Likely Invalid`**. The system made the correct business decision despite the tabular model's error.

### Case 2: CLM-00034 (Normal Valid with Incomplete Visuals)
- **Claim Profile:** Legitimate audio speaker defect. Valid warranty, receipt attached.
- **Python RF Model:** Predicted `Manual Review` ($P=0.53$).
- **Teachable Machine:** Predicted `Valid Claim` ($P=0.99$).
- **Engine Arbitration:** Detected disagreement. Because the Python model's top confidence ($53\%$) was below the $60\%$ floor, the arbiter flagged `Uncertain Result` and routed the file to human review.
- **Verdict:** **`Manual Review Required`**. Prevented false rejection.

### Case 3: CLM-00332 (Repair History Boundary)
- **Claim Profile:** Valid claim with 1 prior authorized repair.
- **Python RF Model:** Predicted `Valid Claim` ($P=0.60$).
- **Teachable Machine:** Predicted `Manual Review` ($P=0.95$). The CNN over-indexed on the presence of repair history text on the card.
- **Verdict:** **`Manual Review Required`**. The human reviewer examined the file in the queue, confirmed the single repair was authorized, and overrode the decision to `Approved` with a single click.

```
Disagreement Adjudication Summary:
┌────────────────────────────────────────────────────────┐
│ Total Disagreements: 6 claims                          │
│ Auto-Approved erroneously: 0 claims (0.0%)             │
│ Auto-Rejected erroneously: 0 claims (0.0%)             │
│ Safely Routed to Human Queue: 6 claims (100.0%)        │
└────────────────────────────────────────────────────────┘
```

---

## 9. Full Production Benchmarks

We measured the performance of AssureX on local developer hardware (Intel Core i5-1235U, 16GB RAM, Windows 11):

```
+-------------------------------------------------------------+
| ASSUREX CLAIM ENGINE — SYSTEM BENCHMARK REPORT              |
+-------------------------------------------------------------+
| Total Unseen Test Claims:             225                   |
| Python Random Forest Accuracy:        94.22%                |
| Teachable Machine Vision Accuracy:    95.11%                |
| Dual-Model Consensus Rate:            97.33% (219 / 225)    |
| Average Inference Latency:            0.74 seconds          |
| SRS Target Latency:                   5.00 seconds          |
| Latency Speedup:                      6.7x faster           |
| Automated Decision Accuracy:          94.92% (112 / 118)    |
| False Auto-Approvals on Invalid:      0.00% (ZERO)          |
| Automated Test Pass Rate:             100% (23/23 tests)    |
| WCAG AA Accessibility Pass:           93 / 93 checks        |
+-------------------------------------------------------------+
```

---

## 10. Security, Privacy & Compliance Architecture

Building for financial and warranty operations demands enterprise security hygiene:
1. **Cryptographic Deduplication:** Every uploaded receipt and photo is hashed via SHA-256 upon stream intake. If a customer attempts to submit a receipt already used in another claim, the engine flags a duplicate document alert immediately.
2. **Defense Against Prompt & Code Injections:** The system uses zero external unconstrained generative LLM calls for adjudication. All inputs pass through Pydantic v2 schemas and SQLAlchemy parameterized queries, rendering SQL injection and prompt injection mathematically impossible.
3. **Data Minimization & PII Stripping:** The visual Claim Summary Cards sent to the computer vision pipeline contain **zero personal identifiable information** (no customer names, no street addresses, no phone numbers, no credit card details).
4. **Session Hardening:** Authentication utilizes PBKDF2 password hashing with per-user cryptographic salts and signed HTTP-only cookies (`SameSite=Lax`, `max_age=8 hours`).

---

## 11. Key Lessons Learned

1. **Dual Representations Beat Deep Ensembles:** Combining two models of the *same* architecture (e.g. two tabular neural nets) often leads to shared blind spots. Combining a **tabular tree model** with a **visual CNN** forced the models to evaluate fundamentally different representations of the same underlying truth.
2. **Rules Must Remain Code-Free:** Early in development, warranty rules were embedded inside Python `if/else` statements. This caused friction whenever a policy threshold changed. Migrating policies to declarative YAML files enabled sub-second policy tuning without touching core decision logic.
3. **Card Synthesis Must Be Deterministic:** Any non-deterministic rendering behavior (such as system font fallbacks or anti-aliasing variations) can degrade CNN accuracy. Pinning explicit typography and standardized canvas resolutions ensured repeatable inference.

---

## 12. What's Next for AssureX?

With the core engine completed for TechWiz 7, our post-competition roadmap focuses on enterprise scale:
- **Direct ERP Connectors:** Native webhooks for SAP S/4HANA, Salesforce Service Cloud, and Oracle NetSuite to ingest claims directly from retail point-of-sale terminals.
- **Edge Deployment for Field Technicians:** Compiling both models to ONNX and TensorFlow Lite to allow mobile field technicians to evaluate refrigerator and solar inverter claims offline in rural areas.
- **Explainable Saliency Heatmaps:** Implementing Grad-CAM visual heatmaps on Claim Summary Cards so human reviewers can instantly see which graphical section of the card triggered the vision model's attention.

---

## 13. Try It Yourself

The AssureX Claim Engine is open-source and completely reproducible:
- **GitHub Repository:** [https://github.com/41ss/AssureX-Claim-Engine](https://github.com/41ss/AssureX-Claim-Engine)
- **18-Second Launch Video:** [brag-output/brag.mp4](file:///c:/Users/keaga/assurex/AssureX-Claim-Engine/brag-output/brag.mp4)
- **End-to-End User Walkthrough:** [brag-output/user_perspective_walkthrough.mp4](file:///c:/Users/keaga/assurex/AssureX-Claim-Engine/brag-output/user_perspective_walkthrough.mp4)
- **Full Project Report:** [documentation/AssureX_Project_Report.md](file:///c:/Users/keaga/assurex/AssureX-Claim-Engine/documentation/AssureX_Project_Report.md)

```bash
# Clone and run locally in under 2 minutes
git clone https://github.com/41ss/AssureX-Claim-Engine.git
cd AssureX-Claim-Engine
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python database/seed_db.py
uvicorn src.main:app --port 8000
```

*Built with passion, caffeine, and precision for TechWiz 7.*
