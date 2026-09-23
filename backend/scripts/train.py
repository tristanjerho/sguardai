"""
SmileGuard AI - Real CNN Training Pipeline
- Pretrained EfficientNetB0 backbone with transfer learning & fine-tuning
- Dynamic classification head adapting to the actual number of classes
- Balanced class weighting for handling imbalanced medical categories
- Evaluates on the isolated, held-out test set (Zero Data Leakage)
- Generates authentic model metadata, metrics, and confusion matrix
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
from sklearn.utils.class_weight import compute_class_weight
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, precision_recall_fscore_support

# Fix seeds for reproducibility
np.random.seed(42)
tf.random.set_seed(42)

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROCESSED_DATASET_DIR = BACKEND_DIR / "dataset" / "processed"
MODELS_DIR = BACKEND_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

MODEL_FILE = MODELS_DIR / "smileguard_model.keras"
CLASS_NAMES_FILE = MODELS_DIR / "class_names.json"
METADATA_FILE = MODELS_DIR / "model_metadata.json"
CONFUSION_MATRIX_PNG = MODELS_DIR / "confusion_matrix.png"
TRAINING_CURVES_PNG = MODELS_DIR / "training_history.png"

IMAGE_SIZE = (224, 224)
BATCH_SIZE = 16
PHASE1_EPOCHS = 15
PHASE2_EPOCHS = 25

def build_datasets():
    train_dir = PROCESSED_DATASET_DIR / "train"
    val_dir = PROCESSED_DATASET_DIR / "val"
    test_dir = PROCESSED_DATASET_DIR / "test"

    if not train_dir.exists() or not val_dir.exists() or not test_dir.exists():
        raise FileNotFoundError("Processed dataset directories not found. Run prepare_dataset.py first.")

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
    num_classes = len(class_names)
    print(f"[*] Loaded datasets with {num_classes} classes: {class_names}")

    # Compute class weights to address dental pathology class imbalance
    labels = []
    for _, y in train_ds:
        labels.extend(np.argmax(y.numpy(), axis=1))
    labels = np.array(labels)

    class_weights_arr = compute_class_weight(
        class_weight='balanced',
        classes=np.unique(labels),
        y=labels
    )
    class_weight_dict = {i: float(w) for i, w in enumerate(class_weights_arr)}
    print(f"[*] Computed balanced class weights: {class_weight_dict}")

    # Optimize data pipeline caching/prefetching
    train_ds = train_ds.cache().prefetch(buffer_size=tf.data.AUTOTUNE)
    val_ds = val_ds.cache().prefetch(buffer_size=tf.data.AUTOTUNE)
    test_ds = test_ds.cache().prefetch(buffer_size=tf.data.AUTOTUNE)

    return train_ds, val_ds, test_ds, class_names, class_weight_dict

def build_model(num_classes: int):
    # Data augmentation block tailored for dental radiographs
    data_augmentation = keras.Sequential(
        [
            layers.RandomFlip("horizontal"),
            layers.RandomRotation(0.08),
            layers.RandomZoom(0.08),
            layers.RandomTranslation(0.05, 0.05),
        ],
        name="data_augmentation",
    )

    # Base pretrained model
    # Note: EfficientNetB0 has built-in rescaling [0, 255] -> [-1, 1] / normalized
    base_model = EfficientNetB0(
        include_top=False,
        weights="imagenet",
        input_shape=(IMAGE_SIZE[0], IMAGE_SIZE[1], 3)
    )
    base_model.trainable = False  # Freeze for Phase 1

    inputs = keras.Input(shape=(IMAGE_SIZE[0], IMAGE_SIZE[1], 3), name="input_image")
    x = data_augmentation(inputs)
    x = base_model(x, training=False)
    x = layers.GlobalAveragePooling2D(name="avg_pool")(x)
    x = layers.BatchNormalization(name="batch_norm")(x)
    x = layers.Dense(128, activation="relu", kernel_regularizer=regularizers.l2(1e-4), name="dense_features")(x)
    x = layers.Dropout(0.35, name="top_dropout")(x)
    outputs = layers.Dense(num_classes, activation="softmax", name="predictions")(x)

    model = keras.Model(inputs=inputs, outputs=outputs, name="SmileGuard_EfficientNetB0")
    return model, base_model

def train():
    start_time = time.time()
    train_ds, val_ds, test_ds, class_names, class_weight_dict = build_datasets()
    num_classes = len(class_names)

    # Save class names JSON immediately
    with open(CLASS_NAMES_FILE, "w") as f:
        json.dump(class_names, f, indent=2)
    print(f"[*] Saved class names to {CLASS_NAMES_FILE}")

    model, base_model = build_model(num_classes)
    model.summary()

    # Phase 1: Train classification head
    print("\n" + "="*50)
    print("[*] PHASE 1: Training Classification Head (Backbone Frozen)...")
    print("="*50)

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-3),
        loss="categorical_crossentropy",
        metrics=["accuracy", keras.metrics.Precision(name="precision"), keras.metrics.Recall(name="recall")]
    )

    history1 = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=PHASE1_EPOCHS,
        class_weight=class_weight_dict,
        verbose=1
    )

    # Phase 2: Fine-Tuning Top Convolutional Blocks
    print("\n" + "="*50)
    print("[*] PHASE 2: Fine-Tuning Top EfficientNet Convolutional Layers...")
    print("="*50)

    base_model.trainable = True
    # Freeze bottom layers, unfreeze top layers (block6, block7, top_conv)
    for layer in base_model.layers[:-30]:
        layer.trainable = False
    for layer in base_model.layers[-30:]:
        layer.trainable = True

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-5),
        loss="categorical_crossentropy",
        metrics=["accuracy", keras.metrics.Precision(name="precision"), keras.metrics.Recall(name="recall")]
    )

    callbacks = [
        keras.callbacks.EarlyStopping(
            monitor="val_loss",
            patience=8,
            restore_best_weights=True,
            verbose=1
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=4,
            min_lr=1e-7,
            verbose=1
        ),
        keras.callbacks.ModelCheckpoint(
            filepath=str(MODEL_FILE),
            monitor="val_accuracy",
            save_best_only=True,
            verbose=1
        )
    ]

    history2 = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=PHASE2_EPOCHS,
        class_weight=class_weight_dict,
        callbacks=callbacks,
        verbose=1
    )

    # Save final best model
    model.save(MODEL_FILE)
    print(f"\n[*] Successfully saved trained model to {MODEL_FILE}")

    # ==========================================================
    # HELD-OUT TEST EVALUATION
    # ==========================================================
    print("\n" + "="*50)
    print("[*] EVALUATING ON ISOLATED HELD-OUT TEST DATASET...")
    print("="*50)

    y_true_all = []
    y_pred_all = []
    y_probs_all = []

    for images, labels in test_ds:
        preds = model.predict(images, verbose=0)
        y_true_all.extend(np.argmax(labels.numpy(), axis=1))
        y_pred_all.extend(np.argmax(preds, axis=1))
        y_probs_all.extend(preds)

    y_true = np.array(y_true_all)
    y_pred = np.array(y_pred_all)
    y_probs = np.array(y_probs_all)

    test_accuracy = float(accuracy_score(y_true, y_pred))
    precision, recall, f1, support = precision_recall_fscore_support(
        y_true, y_pred, average='weighted', zero_division=0
    )
    report_dict = classification_report(
        y_true, y_pred, target_names=class_names, output_dict=True, zero_division=0
    )
    conf_mat = confusion_matrix(y_true, y_pred).tolist()

    print(f"[*] Held-out Test Accuracy: {test_accuracy*100:.2f}%")
    print(f"[*] Weighted Precision: {precision:.4f}")
    print(f"[*] Weighted Recall: {recall:.4f}")
    print(f"[*] Weighted F1-Score: {f1:.4f}")
    print("\nDetailed Test Classification Report:")
    print(classification_report(y_true, y_pred, target_names=class_names, zero_division=0))

    # Save Confusion Matrix plot
    fig, ax = plt.subplots(figsize=(8, 6))
    cm_arr = np.array(conf_mat)
    cax = ax.imshow(cm_arr, interpolation='nearest', cmap=plt.cm.Blues)
    plt.title("SmileGuard AI - Confusion Matrix (Held-out Test Set)")
    fig.colorbar(cax)
    tick_marks = np.arange(len(class_names))
    plt.xticks(tick_marks, class_names, rotation=35, ha='right')
    plt.yticks(tick_marks, class_names)
    
    # Annotate values
    thresh = cm_arr.max() / 2.
    for i in range(cm_arr.shape[0]):
        for j in range(cm_arr.shape[1]):
            ax.text(j, i, format(cm_arr[i, j], 'd'),
                    ha="center", va="center",
                    color="white" if cm_arr[i, j] > thresh else "black")
    
    plt.xlabel("Predicted Label")
    plt.ylabel("True Label")
    plt.tight_layout()
    plt.savefig(CONFUSION_MATRIX_PNG, dpi=200)
    plt.close()
    print(f"[*] Saved Confusion Matrix plot to {CONFUSION_MATRIX_PNG}")

    # Combine training curves and save plot
    acc = history1.history['accuracy'] + history2.history['accuracy']
    val_acc = history1.history['val_accuracy'] + history2.history['val_accuracy']
    loss = history1.history['loss'] + history2.history['loss']
    val_loss = history1.history['val_loss'] + history2.history['val_loss']

    plt.figure(figsize=(12, 4))
    plt.subplot(1, 2, 1)
    plt.plot(acc, label='Train Accuracy', color='#0ea5e9')
    plt.plot(val_acc, label='Val Accuracy', color='#10b981')
    plt.axvline(x=PHASE1_EPOCHS - 1, color='gray', linestyle='--', label='Fine-Tuning Start')
    plt.title('Training & Validation Accuracy')
    plt.xlabel('Epoch')
    plt.ylabel('Accuracy')
    plt.legend()

    plt.subplot(1, 2, 2)
    plt.plot(loss, label='Train Loss', color='#f43f5e')
    plt.plot(val_loss, label='Val Loss', color='#8b5cf6')
    plt.axvline(x=PHASE1_EPOCHS - 1, color='gray', linestyle='--', label='Fine-Tuning Start')
    plt.title('Training & Validation Loss')
    plt.xlabel('Epoch')
    plt.ylabel('Loss')
    plt.legend()
    plt.tight_layout()
    plt.savefig(TRAINING_CURVES_PNG, dpi=200)
    plt.close()
    print(f"[*] Saved Training Curves plot to {TRAINING_CURVES_PNG}")

    # Read dataset summary
    summary_file = BACKEND_DIR / "dataset" / "dataset_summary.json"
    with open(summary_file, "r") as f:
        ds_summary = json.load(f)

    # Save real model metadata
    metadata = {
        "model_name": "SmileGuard Dental Vision CNN",
        "architecture": "EfficientNetB0 (Transfer Learning + Fine-Tuning)",
        "input_size": [IMAGE_SIZE[0], IMAGE_SIZE[1], 3],
        "num_classes": num_classes,
        "classes": class_names,
        "class_to_idx": {cls: i for i, cls in enumerate(class_names)},
        "dataset": {
            "source": "Dental OPG X-ray Dataset",
            "total_images": ds_summary.get("total_valid_images", 517),
            "training_images": ds_summary["splits"]["train_count"],
            "validation_images": ds_summary["splits"]["val_count"],
            "test_images": ds_summary["splits"]["test_count"],
            "class_distribution": ds_summary.get("class_distribution", {})
        },
        "training": {
            "phase1_epochs": PHASE1_EPOCHS,
            "phase2_epochs": len(history2.history['accuracy']),
            "total_epochs": PHASE1_EPOCHS + len(history2.history['accuracy']),
            "batch_size": BATCH_SIZE,
            "optimizer": "Adam",
            "loss_function": "categorical_crossentropy",
            "class_weights_applied": class_weight_dict,
            "training_duration_seconds": round(time.time() - start_time, 2),
            "training_completed_at": datetime.utcnow().isoformat() + "Z"
        },
        "evaluation": {
            "test_dataset_size": ds_summary["splits"]["test_count"],
            "test_accuracy": round(test_accuracy, 4),
            "test_precision_weighted": round(float(precision), 4),
            "test_recall_weighted": round(float(recall), 4),
            "test_f1_weighted": round(float(f1), 4),
            "confusion_matrix": conf_mat,
            "per_class_metrics": {
                cls: {
                    "precision": round(report_dict[cls]["precision"], 4),
                    "recall": round(report_dict[cls]["recall"], 4),
                    "f1_score": round(report_dict[cls]["f1-score"], 4),
                    "support": report_dict[cls]["support"]
                }
                for cls in class_names if cls in report_dict
            }
        }
    }

    with open(METADATA_FILE, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"[*] Saved genuine model metadata to {METADATA_FILE}")
    print(f"\n[✓] Training and Evaluation completed successfully in {time.time() - start_time:.1f}s.")

if __name__ == "__main__":
    train()
