# SmileGuard AI — CNN Model Training & Evaluation Documentation

> **Document Purpose:** Technical Methodology, Training Pipeline, Architecture, and Evaluation Report for Capstone / Thesis Defense Panel  
> **Project:** SmileGuard AI — Intelligent Dental Clinic Management & Two-Stage AI Radiodiagnostic Platform  
> **Models Documented:**  
> 1. **Stage 1 (`xray_validator`)** — Binary Dental OPG Input Validator CNN  
> 2. **Stage 2 (`smileguard_model`)** — 6-Class Dental Pathology Classifier CNN  

---

## 1. Executive Summary & Two-Stage Pipeline Architecture

SmileGuard AI implements a **Two-Stage Convolutional Neural Network (CNN)** diagnostic pipeline for automated screening of dental panoramic radiographs (Orthopantomograms / OPGs). Rather than feeding every uploaded image directly into a pathology classifier, the system separates **input domain validation** (Stage 1) from **pathology classification** (Stage 2) to enforce a strict **Zero Fabrication Policy**: non-radiograph images (photographs, documents, selfies, screenshots) are blocked before clinical inference or heatmap generation runs.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    Uploaded Image (JPG / PNG / WebP / URL)              │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
                    [ Preprocessing & Tensor Formatting ]
                    RGB Conversion ─► Resize (224 × 224) ─► Float32 [0, 255]
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│             STAGE 1: DENTAL OPG VALIDATOR CNN (Gatekeeper)              │
│         EfficientNetB0 Binary Classifier (xray_validator.keras/.tflite) │
│                Classes: ["dental_opg", "non_opg"]                       │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                   P(dental_opg) >= 0.60 Threshold?
                      ┌──────────────┴──────────────┐
                   [ NO ]                        [ YES ]
                      │                             │
                      ▼                             ▼
        ┌──────────────────────────┐  ┌───────────────────────────────────┐
        │   REJECT INPUT & HALT    │  │ STAGE 2: PATHOLOGY CLASSIFIER CNN │
        │ - status: "invalid_xray" │  │ EfficientNetB0 6-Class Classifier │
        │ - Stage 2: SKIPPED       │  │ (smileguard_model.keras/.tflite)  │
        │ - Heatmap: SKIPPED       │  └─────────────────┬─────────────────┘
        └──────────────────────────┘                    │
                                                        ▼
                                      ┌───────────────────────────────────┐
                                      │ 6-Class Softmax Probabilities +   │
                                      │ Spatial Activation / Grad-CAM Map │
                                      └───────────────────────────────────┘
```

> **Note on Legacy Documentation References:** Older planning/assistant text files (`README.md`, `NEW UPDATES`, `api/chat.js`, and `backend/chat_engine.py`) reference an earlier design using MobileNetV2 for Stage 1, 4 pathology classes, or a `0.50` threshold / HTTP `422` response. The **actual trained models and active inference code** in `backend/training/train_xray_validator.py`, `backend/scripts/train.py`, and `backend/main.py` both use **EfficientNetB0**, classify **6 pathology classes**, and enforce a calibrated Stage 1 threshold of **`0.60`** (returning `"status": "invalid_xray"`).

---

## 2. Environment, Frameworks & Reproducibility

| Component | Configuration / Package | Source |
| :--- | :--- | :--- |
| **Language & Runtime** | Python 3.11 (Docker/Render) / Python 3.12.3 (local training environment) | `backend/Dockerfile`, `backend/render.yaml` |
| **Deep Learning Framework** | TensorFlow / Keras (`tensorflow>=2.15.0`; verified locally on `2.21.0`) | `backend/requirements.txt` |
| **Hardware Execution** | CPU training on Windows (native TensorFlow >= 2.11 CPU runtime) | Training run environment |
| **Data & Metrics Tooling** | `scikit-learn>=1.4.0`, `numpy>=1.26.0`, `Pillow>=10.2.0`, `matplotlib>=3.8.0`, `opencv-python-headless>=4.9.0` | `backend/requirements.txt` |
| **API & Deployment** | FastAPI (`>=0.110.0`), Uvicorn (`>=0.28.0`), TensorFlow Lite (`Optimizations.DEFAULT`) | `backend/main.py`, `backend/scripts/convert_to_tflite.py` |
| **Random Seed Control** | `np.random.seed(42)`, `tf.random.set_seed(42)`, `random_state=42`, `seed=42` | `prepare_dataset.py`, `train.py`, `train_xray_validator.py` |

---

## 3. Dataset Acquisition, Auditing & Splitting

### 3.1 Stage 1 Dataset — Dental OPG Validator (`prepare_validator_dataset.py`)

The Stage 1 binary gatekeeper dataset was constructed to distinguish authentic panoramic dental radiographs from everyday non-dental imagery:

- **Positive Class (`dental_opg`):** Validated panoramic radiographs drawn from `backend/dataset/raw/`.
- **Negative Class (`non_opg`):** Real-world distractor images (photographs, documents, screenshots, and system wallpapers) collected from local user directories (`Downloads` excluding dental/OPG folders, `Pictures`, `OneDrive\Pictures`, and `C:\Windows\Web`).
- **Integrity & Deduplication:**
  1. Verified every image using Pillow `img.verify()` and discarded any image smaller than `32 × 32` pixels.
  2. Computed **SHA-256** file hashes to remove intra-class duplicates and ensure zero overlap between `dental_opg` and `non_opg`.
- **Class Balancing:** Balanced to a 1:1 ratio using `min(len(valid_opg), len(valid_non_opg))` = **232 images per class** (**464 total images**).
- **Stratified Split (70% / 15% / 15%):** Split via `sklearn.model_selection.train_test_split(..., stratify=y, random_state=42)`:

| Split | `dental_opg` | `non_opg` | Total on Disk | Proportion |
| :--- | :---: | :---: | :---: | :---: |
| **Training** | 162 | 162 | **324** | 69.8% |
| **Validation** | 35 | 35 | **70** | 15.1% |
| **Held-Out Test** | 35 | 35* | **70*** | 15.1% |
| **Total** | **232** | **232** | **464** | **100%** |

> *\*TensorFlow Decoder Note:* During Stage 1 training and evaluation in `train_xray_validator.py`, `tf.keras.utils.image_dataset_from_directory` skips `.webp` files by default (decoding `.jpg`, `.jpeg`, `.png`, `.bmp`, `.gif`). Because 6 `non_opg` test files (as well as 6 train and 1 val `non_opg` file) had `.webp` extensions, the held-out evaluation report in `xray_validator_metadata.json` evaluated **64 test images** (`35 dental_opg` + `29 non_opg`).

---

### 3.2 Stage 2 Dataset — 6-Class Dental Pathology (`prepare_dataset.py`)

- **Source Dataset:** Local `Dental OPG XRAY Dataset\Dental OPG (Classification)` containing 6 diagnostic folders.
- **Audit & Filtering:**
  - Accepted formats: `.jpg`, `.jpeg`, `.png`, `.bmp`, `.tiff`, `.webp`.
  - Validated all images via Pillow `img.verify()` and minimum size check (`>= 32 × 32` px).
  - **Total Valid Images:** **517 image records** (`0` corrupted files discarded).
  - Intra-class SHA-256 deduplication applied within each class folder.
- **Stratified Split Per Class (70% Train / 15% Validation / 15% Held-Out Test):**
  - Executed per class with `n_test = max(1, round(n * 0.15))`, `n_val = max(1, round(n * 0.15))`, and deterministic `train_test_split(..., random_state=42)`.

| Index | Class Name | Clinical Meaning | Train (70.2%) | Val (14.9%) | Test (14.9%) | Total |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `0` | `BDC-BDR` | Broken Down Crown / Broken Down Root | 36 | 8 | 8 | **52** |
| `1` | `Caries` | Enamel / dentin demineralization (dental decay) | 83 | 18 | 18 | **119** |
| `2` | `Fractured Teeth` | Structural crown or root discontinuity | 9 | 2 | 2 | **13** |
| `3` | `Healthy Teeth` | Normal dentition without active pathology | 157 | 33 | 33 | **223** |
| `4` | `Impacted teeth` | Blocked / abnormally angulated eruption | 61 | 13 | 13 | **87** |
| `5` | `Infection` | Periapical radiolucency / abscess / periodontitis | 17 | 3 | 3 | **23** |
| — | **Total** | **6 Clinical Categories** | **363** | **77** | **77** | **517** |

### 3.3 Input Preprocessing & Data Pipeline

In both `train_xray_validator.py` and `train.py`:
- **Image Loading:** `tf.keras.utils.image_dataset_from_directory`
- **Target Spatial Resolution:** `224 × 224` RGB (`3` channels)
- **Batch Size:** `16`
- **Label Encoding:** `label_mode='categorical'` (one-hot vectors)
- **Pixel Normalization:** **No manual `/ 255.0` scaling was applied externally** because `tf.keras.applications.EfficientNetB0` embeds internal rescaling and normalization layers that natively accept `[0, 255]` float32 tensors. The production API (`backend/main.py`) matches this identically (`np.array(resized_img, dtype=np.float32)`).
- **Performance Optimization:** `.cache().prefetch(buffer_size=tf.data.AUTOTUNE)`.

---

## 4. CNN Architecture & Training Strategy

### 4.1 Why EfficientNetB0?

Both models use **EfficientNetB0** pretrained on **ImageNet** (`include_top=False`) via transfer learning:
1. **Compound Scaling Efficiency:** Balances network depth, width, and input resolution (`224 × 224`), achieving strong feature representation with only **~4.05M backbone parameters**—making CPU training fast and allowing TFLite deployment within cloud free-tier memory limits (`< 512 MB` RAM on Render).
2. **Transfer Learning Advantage:** Early and mid-level ImageNet convolutional filters capture universal edges, textures, and contrast boundaries, which adapt well to radiographic anatomical boundaries when paired with fine-tuning on top convolutional blocks.

### 4.2 Layer-by-Layer Model Architectures

#### Stage 1: `SmileGuard_XRay_Validator` (`xray_validator.keras`)

| Layer Name | Layer Type | Output / Config | Parameters |
| :--- | :--- | :--- | :---: |
| `validator_input` | `InputLayer` | `(None, 224, 224, 3)` | 0 |
| `validator_augmentation` | `Sequential` | Flip(`horizontal`), Rotation(`0.05`), Zoom(`0.05`) | 0 |
| `efficientnetb0` | `Functional` (Backbone) | `weights="imagenet"`, `include_top=False`, `7×7×1280` | 4,049,571 |
| `val_avg_pool` | `GlobalAveragePooling2D` | `1280`-dim feature vector | 0 |
| `val_bn` | `BatchNormalization` | Feature normalization | 5,120 |
| `val_dense` | `Dense` | `64` units, `ReLU`, `L2(1e-4)` | 81,984 |
| `val_dropout` | `Dropout` | `rate = 0.30` | 0 |
| `validator_output` | `Dense` | `2` units, `Softmax` | 130 |
| **Total** | — | **Trainable (Phase 2): `1,547,426` / Non-trainable: `2,589,379`** | **4,136,805** |

#### Stage 2: `SmileGuard_EfficientNetB0` (`smileguard_model.keras`)

| Layer Name | Layer Type | Output / Config | Parameters |
| :--- | :--- | :--- | :---: |
| `input_image` | `InputLayer` | `(None, 224, 224, 3)` | 0 |
| `data_augmentation` | `Sequential` | Flip(`horizontal`), Rotation(`0.08`), Zoom(`0.08`), Translation(`0.05, 0.05`) | 0 |
| `efficientnetb0` | `Functional` (Backbone) | `weights="imagenet"`, `include_top=False`, `7×7×1280` | 4,049,571 |
| `avg_pool` | `GlobalAveragePooling2D` | `1280`-dim feature vector | 0 |
| `batch_norm` | `BatchNormalization` | Feature normalization | 5,120 |
| `dense_features` | `Dense` | `128` units, `ReLU`, `L2(1e-4)` | 163,968 |
| `top_dropout` | `Dropout` | `rate = 0.35` | 0 |
| `predictions` | `Dense` | `6` units, `Softmax` | 774 |
| **Total** | — | **Trainable (Phase 2): `1,663,462` / Non-trainable: `2,555,971`** | **4,219,433** |

### 4.3 Domain-Specific Data Augmentation

On-the-fly Keras augmentation layers execute **only during training** (`training=True`, bypassed at validation/test/inference time):
- **Horizontal Flip:** Preserves dental panoramic anatomy because human dentition is bilaterally symmetric across the midline. *(Vertical flipping was intentionally omitted because upside-down jaws do not occur in standard OPG radiographs.)*
- **Small Rotation (`±8%` / ~`±28.8°` in Stage 2; `±5%` in Stage 1):** Simulates minor patient head tilt inside the panoramic unit.
- **Random Zoom (`±8%` Stage 2; `±5%` Stage 1) & Translation (`±5%`):** Simulates framing differences and jaw positioning shifts across X-ray machines.

### 4.4 Class Imbalance Mitigation (Stage 2)

Because the pathology dataset ranges from `157` training samples (`Healthy Teeth`) down to `9` training samples (`Fractured Teeth`), `train.py` computed inverse-frequency **balanced class weights** using Scikit-Learn:

$$w_c = \frac{N_{\text{train}}}{K \cdot N_c}$$

where $N_{\text{train}} = 363$ and $K = 6$:

| Class Index | Class Name | Training Samples ($N_c$) | Applied Weight ($w_c$) |
| :---: | :--- | :---: | :---: |
| `0` | `BDC-BDR` | 36 | `1.6806` |
| `1` | `Caries` | 83 | `0.7289` |
| `2` | `Fractured Teeth` | 9 | `6.7222` |
| `3` | `Healthy Teeth` | 157 | `0.3854` |
| `4` | `Impacted teeth` | 61 | `0.9918` |
| `5` | `Infection` | 17 | `3.5588` |

---

## 5. Two-Phase Training Procedure & Hyperparameters

Both CNNs were trained using a **Two-Phase Transfer Learning** protocol to prevent large initial gradients from destroying ImageNet weights:

| Hyperparameter / Setting | Stage 1 (`train_xray_validator.py`) | Stage 2 (`train.py`) |
| :--- | :--- | :--- |
| **Phase 1: Backbone State** | Frozen (`base_model.trainable = False`) | Frozen (`base_model.trainable = False`) |
| **Phase 1: Epochs & LR** | `10` epochs, `Adam(lr=1e-3)` | `15` epochs, `Adam(lr=1e-3)` |
| **Phase 2: Fine-Tuned Layers** | Top **`25`** layers of `EfficientNetB0` unfrozen | Top **`30`** layers of `EfficientNetB0` unfrozen (`block6`/`block7`/`top_conv`) |
| **Phase 2: Max Epochs & LR** | Up to `15` epochs, `Adam(lr=1e-5)` | Up to `25` epochs, `Adam(lr=1e-5)` |
| **Loss Function** | `categorical_crossentropy` | `categorical_crossentropy` (with `class_weight`) |
| **Batch Size** | `16` | `16` |
| **Tracked Metrics** | `accuracy`, `Precision`, `Recall` | `accuracy`, `Precision`, `Recall` |
| **EarlyStopping** | `monitor="val_loss"`, `patience=5`, `restore_best_weights=True` | `monitor="val_loss"`, `patience=8`, `restore_best_weights=True` |
| **ReduceLROnPlateau** | — | `monitor="val_loss"`, `factor=0.5`, `patience=4`, `min_lr=1e-7` |
| **ModelCheckpoint** | `monitor="val_accuracy"`, `save_best_only=True` | `monitor="val_accuracy"`, `save_best_only=True` |
| **Actual Epochs Completed** | Up to `25` max (`10` + Phase 2) | **`24` total epochs** (`15` Phase 1 + `9` Phase 2, early stopped) |
| **Training Duration** | **`176.86 seconds`** (~2.95 min) | **`216.25 seconds`** (~3.60 min) |
| **Completion Timestamp** | `2026-09-23T23:29:47Z` | `2026-09-23T15:12:07Z` |

### Stage 1 Decision Threshold Calibration (`train_xray_validator.py`)

To avoid arbitrary threshold guessing and prevent test-set leakage, the binary acceptance threshold was calibrated **exclusively on the validation set** (`val_ds`):
1. Swept candidate thresholds $t \in [0.10, 0.90]$ (step `0.01`) for $P(\text{dental\_opg}) \ge t$.
2. Selected the threshold maximizing binary validation F1-score, constrained by a conservative floor: `max(0.60, best_thresh)`.
3. **Established Threshold:** **`0.60`** (saved in `xray_validator_metadata.json` and dynamically loaded by `backend/main.py`).

---

## 6. Held-Out Test Evaluation Results

All evaluation metrics were recorded on the **isolated held-out test sets** (never seen during training or hyperparameter tuning).

### 6.1 Stage 1: Dental OPG Validator Results (`xray_validator_metadata.json`)

- **Test Samples Evaluated:** `64` (`35 dental_opg`, `29 non_opg`)
- **Decision Threshold Applied:** `0.60`
- **Test Accuracy:** **`100.00%`** (`1.0`)
- **Weighted Precision / Recall / F1-Score:** **`1.0000` / `1.0000` / `1.0000`**

| Ground Truth \ Predicted | `dental_opg` | `non_opg` | Support | Precision | Recall | F1-Score |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **`dental_opg`** | **35** | 0 | 35 | 1.0000 | 1.0000 | 1.0000 |
| **`non_opg`** | 0 | **29** | 29 | 1.0000 | 1.0000 | 1.0000 |

*(Artifact plot: `backend/models/xray_validator_confusion_matrix.png`)*

---

### 6.2 Stage 2: Dental Pathology Classifier Results (`model_metadata.json`)

- **Test Samples Evaluated:** `77`
- **Held-Out Test Accuracy:** **`16.88%`** (`0.1688`)
- **Weighted Precision:** `0.2029`
- **Weighted Recall:** `0.1688`
- **Weighted F1-Score:** `0.1764`

#### Per-Class Performance Breakdown

| Class | Precision | Recall | F1-Score | Test Support |
| :--- | :---: | :---: | :---: | :---: |
| `BDC-BDR` | 0.0000 | 0.0000 | 0.0000 | 8 |
| `Caries` | 0.0000 | 0.0000 | 0.0000 | 18 |
| `Fractured Teeth` | 0.0769 | 0.5000 | 0.1333 | 2 |
| `Healthy Teeth` | 0.3636 | 0.2424 | 0.2909 | 33 |
| `Impacted teeth` | 0.2667 | 0.3077 | 0.2857 | 13 |
| `Infection` | 0.0000 | 0.0000 | 0.0000 | 3 |

#### Held-Out Test Confusion Matrix (`77` samples)

| True \ Predicted | BDC-BDR | Caries | Fractured | Healthy | Impacted | Infection |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **BDC-BDR** | **0** | 1 | 3 | 2 | 2 | 0 |
| **Caries** | 7 | **0** | 2 | 7 | 1 | 1 |
| **Fractured Teeth** | 0 | 1 | **1** | 0 | 0 | 0 |
| **Healthy Teeth** | 4 | 3 | 5 | **8** | 8 | 5 |
| **Impacted teeth** | 2 | 1 | 2 | 4 | **4** | 0 |
| **Infection** | 1 | 1 | 0 | 1 | 0 | **0** |

#### Learning Curve Behavior (`backend/models/training_history.png`)
- **Phase 1 (Epochs 0–14):** Training accuracy climbed from `~19%` to `~43%`, while validation accuracy peaked near `~25%` (Epochs 8–11) and validation loss reached its minimum (`~1.76`) around Epoch 5 before beginning to rise.
- **Phase 2 (Epochs 15–23):** Fine-tuning the top 30 EfficientNetB0 layers caused validation loss to climb from `~2.09` to `~2.41` while validation accuracy plateaued at `~17%–19%`, triggering `EarlyStopping(patience=8)` at total epoch `24`.

---

## 7. Root-Cause Analysis of Stage 2 Accuracy & Engineering Findings

In keeping with SmileGuard AI's **Zero Fabrication Policy**, the `16.88%` held-out test accuracy is reported transparently rather than inflated or mocked. A forensic SHA-256 audit of `backend/dataset/raw/` reveals **four concrete technical causes** explaining why Stage 1 achieved `100%` while Stage 2 struggled:

1. **Multi-Label Source Dataset Framed as Single-Label Softmax (Primary Cause):**
   - Out of the **517 image files** across the 6 class folders in `backend/dataset/raw/`, there are only **232 unique SHA-256 image hashes**, and **178 of those 232 unique OPGs appear identically in 2 to 5 class folders simultaneously** (e.g., `2.jpg` appears identically in `BDC-BDR`, `Caries`, `Healthy Teeth`, `Impacted teeth`, and `Infection`).
   - Because `prepare_dataset.py` only deduplicated *within* each class (`seen_in_class`) rather than *across* classes, the exact same radiograph was fed into `train.py` multiple times with **contradictory one-hot labels**, and identical images appeared across `train` and `test` under different labels. Under single-label `softmax` + `categorical_crossentropy`, mutually exclusive gradients prevent convergence (~1/6 = `16.67%` chance baseline).
2. **Whole-OPG Downsampling to `224 × 224`:**
   - Panoramic radiographs capture up to 32 teeth plus jaw structures at high resolution. Resizing an entire OPG to `224 × 224` pixels compresses subtle localized findings (such as interproximal caries or hairline root fractures) into just a few pixels.
3. **Severe Minority Class Scarcity:**
   - `Fractured Teeth` (`9` train / `2` val / `2` test) and `Infection` (`17` train / `3` val / `3` test) provide too few distinct samples for a `1.66M`-trainable-parameter fine-tuning phase, leading to overfitting despite `Dropout(0.35)` and `L2(1e-4)` regularization.
4. **Post-Callback Save Order in `train.py`:**
   - Although `ModelCheckpoint(monitor="val_accuracy", save_best_only=True)` saved the best validation accuracy weights during Phase 2, `EarlyStopping(monitor="val_loss", restore_best_weights=True)` restored the weights from the lowest `val_loss` epoch at the start of Phase 2, and `model.save(MODEL_FILE)` at line 220 overwrote the checkpoint with those restored weights.

### Recommended Future Improvements (For Panel Recommendations Chapter)
1. **Reformulate as Multi-Label Classification:** Deduplicate by SHA-256 hash into **232 unique OPG records** with multi-hot target vectors (`Dense(6, activation="sigmoid")` + `BinaryCrossentropy`), grouped by image hash before splitting to guarantee zero cross-split image overlap.
2. **Two-Level Object Detection + Classification (Tooth-Level ROI Cropping):** Use an object detector (e.g., YOLOv8 / Faster R-CNN) to crop individual tooth bounding boxes before running EfficientNetB0 pathology classification, or train at higher input resolution (`380 × 380` / `512 × 512`).
3. **Dataset Expansion & External Validation:** Expand minority classes (`Fractured Teeth`, `Infection`, `BDC-BDR`) using multi-center clinical radiographs and evaluate using Macro-F1 and per-class AUROC.

---

## 8. Post-Training Optimization, Explainability & Deployment

### 8.1 TensorFlow Lite Compression (`scripts/convert_to_tflite.py`)

Both trained `.keras` models were converted using **TensorFlow Lite Dynamic-Range Optimization** (`tf.lite.Optimize.DEFAULT`) to run reliably within Render's free-tier `512 MB` RAM limit:

| Model | Keras Size (`.keras`) | TFLite Size (`.tflite`) | Size Reduction |
| :--- | :---: | :---: | :---: |
| **Stage 1 (`xray_validator`)** | `28.44 MiB` (`29,817,932 B`) | `4.45 MiB` (`4,664,904 B`) | **~84.4%** |
| **Stage 2 (`smileguard_model`)** | `29.64 MiB` (`31,082,521 B`) | `4.53 MiB` (`4,750,456 B`) | **~84.7%** |

At API startup (`backend/main.py`), FastAPI prioritizes loading the `.tflite` interpreters (with `tf.config.threading` constrained to `1` inter/intra-op thread) and falls back to `.keras` only if TFLite initialization fails.

### 8.2 Visual Explainability: Offline Pre-Softmax Grad-CAM vs. Cloud Spatial Map

1. **Offline Pre-Softmax Grad-CAM Audit (`backend/scripts/gradcam.py` & `audit_and_verify_gradcam.py`):**
   - Computes gradients $\frac{\partial y^c}{\partial A^k}$ from **pre-softmax linear logits** ($y^c = W \cdot x + b$) back to EfficientNetB0's final convolutional activation tensor `top_activation` (`7 × 7 × 1280`), preventing post-softmax gradient vanishing.
   - Visually audited across all 6 test classes in `backend/reports/gradcam_sanity_proof.png`.
2. **Production Cloud Inference Map (`backend/main.py` -> `generate_spatial_activation_map`):**
   - Because TFLite flatbuffers do not retain intermediate Keras layers for dynamic `tf.GradientTape` backpropagation and keeping full Keras graphs in memory exceeded free-tier cloud RAM, the live API uses a lightweight spatial attention map (`generate_spatial_activation_map` combining Sobel edge magnitudes + Gaussian radiographic focal weighting + power-law sharpening $\gamma = 1.6$ scaled by prediction confidence) rendered with OpenCV `COLORMAP_TURBO` (`alpha = 0.48`).

### 8.3 Automated Verification & Defense Audit Scripts

| Script | Purpose | Key Checks |
| :--- | :--- | :--- |
| `backend/scripts/verify_model.py` | Stage 2 Keras & Grad-CAM Verification | Confirms input `(224,224,3)`, output `(6,)`, softmax sum `= 1.0`, and real Grad-CAM generation on test samples |
| `backend/scripts/test_two_stage_pipeline.py` | End-to-End Two-Stage Defense Suite | Proves real OPGs pass Stage 1 & generate Stage 2 predictions + heatmaps, while non-OPGs are blocked with zero Stage 2 outputs |
| `backend/scripts/audit_and_verify_gradcam.py` | Mathematical Grad-CAM & Gatekeeper Audit | Audits `top_conv` & `top_activation` (`7×7×1280`), verifies 100% blocking on sampled non-OPGs, generates `gradcam_sanity_proof.png` |

---

## 9. Anticipated Panel Defense Questions & Suggested Responses

**Q1: Why did you choose a Two-Stage CNN pipeline instead of a single 7-class CNN (6 pathologies + 1 "Non-X-Ray" class)?**  
*Suggested Answer:* Separating input domain validation (Stage 1) from pathology diagnosis (Stage 2) enforces modularity and safety. Stage 1 acts as an explicit clinical gatekeeper calibrated on a balanced `1:1` dataset (`0.60` threshold, `100%` test accuracy), guaranteeing that arbitrary photos or documents are halted before any diagnostic probabilities or visual overlays are computed.

**Q2: Why did you use EfficientNetB0 instead of training a CNN from scratch or using a heavier backbone like ResNet50 / DenseNet121?**  
*Suggested Answer:* Our dataset has `517` pathology entries and `464` validator images; training a deep CNN from scratch on a dataset of that size leads to severe overfitting. Transfer learning with `EfficientNetB0` leverages ImageNet visual features while keeping total parameters around `4.1M–4.2M`, enabling TFLite compression to `~4.5 MiB` per model so the live API runs smoothly on a `512 MB` RAM cloud server.

**Q3: Why do you train in two phases (frozen backbone first, then unfreezing top layers at `1e-5`)?**  
*Suggested Answer:* The randomly initialized dense classification head initially produces noisy gradients. Freezing `EfficientNetB0` in Phase 1 (`lr=1e-3`) lets the dense head converge safely without corrupting pretrained ImageNet filters. Unfreezing only the top `25–30` layers in Phase 2 at a `100×` smaller learning rate (`1e-5`) allows high-level feature maps to specialize on dental radiograph textures while preserving low-level edge detectors.

**Q4: Why is Stage 2 test accuracy `16.88%`, and what did you discover?**  
*Suggested Answer:* Rather than tuning on the test set or fabricating results, we diagnosed the exact root cause in our dataset audit: the source dataset contains `517` folder entries representing only `232` unique SHA-256 OPG images, with `178` images simultaneously appearing in `2` to `5` pathology folders (because one panoramic X-ray can exhibit caries, an impacted tooth, and healthy teeth at the same time). Formulating a multi-label dataset as a single-label softmax task created contradictory labels across identical images, capping single-label accuracy near the 6-class baseline (`16.7%`). This directly informs our recommended upgrade to **multi-label `sigmoid` classification** and **tooth-level ROI cropping**.

**Q5: How does your system prevent data leakage?**  
*Suggested Answer:* Both datasets perform a deterministic `70% / 15% / 15%` train/validation/test split (`seed=42`) prior to training. Stage 1 threshold calibration (`0.60`) was computed strictly on the validation set (`val_ds`), never on the test set, and in-model Keras data augmentation only runs during `training=True`. *(For Stage 2, we explicitly note as a limitation that cross-class duplicates in the source dataset caused identical OPGs to appear under different class labels across splits, which hash-grouped multi-label splitting will resolve in v2.)*

---

## 10. Artifact & File Reference Map

- **Stage 1 Dataset Prep:** `backend/scripts/prepare_validator_dataset.py` → `backend/reports/xray_validation_dataset_audit.json`
- **Stage 1 Training:** `backend/training/train_xray_validator.py` → `backend/models/xray_validator.keras`, `xray_validator_classes.json`, `xray_validator_metadata.json`, `xray_validator_confusion_matrix.png`
- **Stage 2 Dataset Prep:** `backend/scripts/prepare_dataset.py` → `backend/dataset/dataset_summary.json`
- **Stage 2 Training:** `backend/scripts/train.py` → `backend/models/smileguard_model.keras`, `class_names.json`, `model_metadata.json`, `confusion_matrix.png`, `training_history.png`
- **TFLite Conversion:** `backend/scripts/convert_to_tflite.py` → `backend/models/xray_validator.tflite`, `smileguard_model.tflite`
- **Explainability & Audits:** `backend/scripts/gradcam.py`, `backend/scripts/audit_and_verify_gradcam.py` → `backend/reports/gradcam_sanity_proof.png`
- **Verification Suites:** `backend/scripts/verify_model.py`, `backend/scripts/test_two_stage_pipeline.py`
- **Production Inference Server:** `backend/main.py`

