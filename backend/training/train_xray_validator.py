"""
Stage 1: Real Dental OPG X-ray Validator Training Pipeline
- Trains a binary EfficientNetB0 CNN: Dental OPG X-ray vs Non-Dental-OPG Image
- Establishes a verified validation decision threshold from the validation set
- Evaluates on the held-out test set
- Saves xray_validator.keras, xray_validator_classes.json, and xray_validator_metadata.json
"""

import os
import json
import time
from datetime import datetime
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, regularizers
from tensorflow.keras.applications import EfficientNetB0
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, precision_recall_fscore_support, roc_curve, precision_recall_curve

# Fix seeds
np.random.seed(42)
tf.random.set_seed(42)

BACKEND_DIR = Path(__file__).resolve().parent.parent
DATASET_DIR = BACKEND_DIR / "xray_validation_dataset"
MODELS_DIR = BACKEND_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

MODEL_FILE = MODELS_DIR / "xray_validator.keras"
CLASS_NAMES_FILE = MODELS_DIR / "xray_validator_classes.json"
METADATA_FILE = MODELS_DIR / "xray_validator_metadata.json"
CONFUSION_MATRIX_PNG = MODELS_DIR / "xray_validator_confusion_matrix.png"

IMAGE_SIZE = (224, 224)
BATCH_SIZE = 16
PHASE1_EPOCHS = 10
PHASE2_EPOCHS = 15

def build_datasets():
    train_dir = DATASET_DIR / "train"
    val_dir = DATASET_DIR / "val"
    test_dir = DATASET_DIR / "test"

    train_ds = tf.keras.utils.image_dataset_from_directory(
        train_dir,
        image_size=IMAGE_SIZE,
        batch_size=BATCH_SIZE,
        label_mode='categorical',
        shuffle=True,
        seed=42
    )

    val_ds = tf.keras.utils.image_dataset_from_directory(
        val_dir,
        image_size=IMAGE_SIZE,
        batch_size=BATCH_SIZE,
        label_mode='categorical',
        shuffle=False
    )

    test_ds = tf.keras.utils.image_dataset_from_directory(
        test_dir,
        image_size=IMAGE_SIZE,
        batch_size=BATCH_SIZE,
        label_mode='categorical',
        shuffle=False
    )

    class_names = train_ds.class_names
    print(f"[*] Loaded binary validator dataset with classes: {class_names}")

    train_ds = train_ds.cache().prefetch(buffer_size=tf.data.AUTOTUNE)
    val_ds = val_ds.cache().prefetch(buffer_size=tf.data.AUTOTUNE)
    test_ds = test_ds.cache().prefetch(buffer_size=tf.data.AUTOTUNE)

    return train_ds, val_ds, test_ds, class_names

def build_model(num_classes=2):
    data_augmentation = keras.Sequential(
        [
            layers.RandomFlip("horizontal"),
            layers.RandomRotation(0.05),
            layers.RandomZoom(0.05),
        ],
        name="validator_augmentation",
    )

    base_model = EfficientNetB0(
        include_top=False,
        weights="imagenet",
        input_shape=(IMAGE_SIZE[0], IMAGE_SIZE[1], 3)
    )
    base_model.trainable = False

    inputs = keras.Input(shape=(IMAGE_SIZE[0], IMAGE_SIZE[1], 3), name="validator_input")
    x = data_augmentation(inputs)
    x = base_model(x, training=False)
    x = layers.GlobalAveragePooling2D(name="val_avg_pool")(x)
    x = layers.BatchNormalization(name="val_bn")(x)
    x = layers.Dense(64, activation="relu", kernel_regularizer=regularizers.l2(1e-4), name="val_dense")(x)
    x = layers.Dropout(0.3, name="val_dropout")(x)
    outputs = layers.Dense(num_classes, activation="softmax", name="validator_output")(x)

    model = keras.Model(inputs=inputs, outputs=outputs, name="SmileGuard_XRay_Validator")
    return model, base_model

def train_validator():
    start_time = time.time()
    train_ds, val_ds, test_ds, class_names = build_datasets()

    with open(CLASS_NAMES_FILE, "w") as f:
        json.dump(class_names, f, indent=2)

    model, base_model = build_model(len(class_names))
    model.summary()

    # Phase 1
    print("\n" + "=" * 50)
    print("[*] STAGE 1 VALIDATOR: Phase 1 Feature Extraction...")
    print("=" * 50)

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-3),
        loss="categorical_crossentropy",
        metrics=["accuracy", keras.metrics.Precision(name="precision"), keras.metrics.Recall(name="recall")]
    )

    history1 = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=PHASE1_EPOCHS,
        verbose=1
    )

    # Phase 2 Fine-Tuning
    print("\n" + "=" * 50)
    print("[*] STAGE 1 VALIDATOR: Phase 2 Fine-Tuning Top Layers...")
    print("=" * 50)

    base_model.trainable = True
    for layer in base_model.layers[:-25]:
        layer.trainable = False
    for layer in base_model.layers[-25:]:
        layer.trainable = True

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-5),
        loss="categorical_crossentropy",
        metrics=["accuracy", keras.metrics.Precision(name="precision"), keras.metrics.Recall(name="recall")]
    )

    callbacks = [
        keras.callbacks.EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True, verbose=1),
        keras.callbacks.ModelCheckpoint(filepath=str(MODEL_FILE), monitor="val_accuracy", save_best_only=True, verbose=1)
    ]

    history2 = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=PHASE2_EPOCHS,
        callbacks=callbacks,
        verbose=1
    )

    model.save(MODEL_FILE)
    print(f"[OK] Saved X-ray validator model to {MODEL_FILE}")

    # ==========================================================
    # VALIDATION THRESHOLD DETERMINATION (ON VAL SET ONLY)
    # ==========================================================
    print("\n[*] Determining optimal OPG validation threshold on validation set...")
    opg_idx = class_names.index("dental_opg")

    val_y_true = []
    val_opg_probs = []
    for images, labels in val_ds:
        preds = model.predict(images, verbose=0)
        val_y_true.extend(labels.numpy()[:, opg_idx])
        val_opg_probs.extend(preds[:, opg_idx])

    val_y_true = np.array(val_y_true)
    val_opg_probs = np.array(val_opg_probs)

    # Determine threshold maximizing balanced accuracy / F1 on validation set
    thresholds = np.linspace(0.1, 0.9, 81)
    best_thresh = 0.50
    best_val_f1 = 0.0

    for t in thresholds:
        bin_pred = (val_opg_probs >= t).astype(int)
        p, r, f1, _ = precision_recall_fscore_support(val_y_true, bin_pred, average='binary', zero_division=0)
        if f1 > best_val_f1:
            best_val_f1 = f1
            best_thresh = float(t)

    # Use a conservative threshold (at least 0.50, typically 0.60 - 0.70)
    validation_threshold = round(max(0.60, best_thresh), 2)
    print(f"[OK] Established Validation Decision Threshold: {validation_threshold} (Validation F1: {best_val_f1:.4f})")

    # ==========================================================
    # EVALUATION ON UNSEEN HELD-OUT TEST DATASET
    # ==========================================================
    print("\n" + "=" * 50)
    print("[*] EVALUATING VALIDATOR ON UNSEEN HELD-OUT TEST SET...")
    print("=" * 50)

    test_y_true = []
    test_y_pred = []
    test_opg_probs = []

    for images, labels in test_ds:
        preds = model.predict(images, verbose=0)
        test_y_true.extend(np.argmax(labels.numpy(), axis=1))
        test_opg_probs.extend(preds[:, opg_idx])
        # Apply established threshold
        pred_labels = [opg_idx if p >= validation_threshold else (1 - opg_idx) for p in preds[:, opg_idx]]
        test_y_pred.extend(pred_labels)

    test_y_true = np.array(test_y_true)
    test_y_pred = np.array(test_y_pred)

    test_accuracy = float(accuracy_score(test_y_true, test_y_pred))
    precision, recall, f1, _ = precision_recall_fscore_support(test_y_true, test_y_pred, average='weighted', zero_division=0)
    conf_mat = confusion_matrix(test_y_true, test_y_pred).tolist()
    report_dict = classification_report(test_y_true, test_y_pred, target_names=class_names, output_dict=True, zero_division=0)

    print(f"[*] Held-out Test Accuracy: {test_accuracy*100:.2f}%")
    print(f"[*] Weighted Precision:    {precision:.4f}")
    print(f"[*] Weighted Recall:       {recall:.4f}")
    print(f"[*] Weighted F1-Score:     {f1:.4f}")
    print("\nClassification Report (Test Set):")
    print(classification_report(test_y_true, test_y_pred, target_names=class_names, zero_division=0))

    # Confusion matrix plot
    fig, ax = plt.subplots(figsize=(6, 5))
    cm_arr = np.array(conf_mat)
    cax = ax.imshow(cm_arr, interpolation='nearest', cmap=plt.cm.Greens)
    plt.title("X-Ray Validator - Confusion Matrix (Test Set)")
    fig.colorbar(cax)
    tick_marks = np.arange(len(class_names))
    plt.xticks(tick_marks, class_names, rotation=20, ha='right')
    plt.yticks(tick_marks, class_names)
    thresh = cm_arr.max() / 2.
    for i in range(cm_arr.shape[0]):
        for j in range(cm_arr.shape[1]):
            ax.text(j, i, format(cm_arr[i, j], 'd'),
                    ha="center", va="center",
                    color="white" if cm_arr[i, j] > thresh else "black")
    plt.xlabel("Predicted")
    plt.ylabel("Ground Truth")
    plt.tight_layout()
    plt.savefig(CONFUSION_MATRIX_PNG, dpi=200)
    plt.close()

    # Metadata
    metadata = {
        "model_name": "SmileGuard Dental OPG Input Validator",
        "purpose": "Binary Gatekeeper to verify image is a real dental panoramic X-ray before pathology classification",
        "architecture": "EfficientNetB0 (Transfer Learning + Fine-Tuning)",
        "input_size": [IMAGE_SIZE[0], IMAGE_SIZE[1], 3],
        "classes": class_names,
        "opg_class_name": "dental_opg",
        "non_opg_class_name": "non_opg",
        "validation_decision_threshold": validation_threshold,
        "dataset": {
            "total_images": 464,
            "train_images": 324,
            "validation_images": 70,
            "test_images": 70
        },
        "evaluation": {
            "test_accuracy": round(test_accuracy, 4),
            "test_precision_weighted": round(float(precision), 4),
            "test_recall_weighted": round(float(recall), 4),
            "test_f1_weighted": round(float(f1), 4),
            "confusion_matrix": conf_mat,
            "per_class": report_dict
        },
        "training_completed_at": datetime.now().isoformat() + "Z",
        "training_duration_seconds": round(time.time() - start_time, 2)
    }

    with open(METADATA_FILE, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"[OK] Saved validator metadata to {METADATA_FILE}")
    print("=" * 50)

if __name__ == "__main__":
    train_validator()
