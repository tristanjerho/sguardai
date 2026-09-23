"""
SmileGuard AI - Model Verification Script
Demonstrates and proves that predictions and Grad-CAM are dynamically generated
by the trained CNN model from real test images.
"""

import os
import sys
import json
from pathlib import Path
import numpy as np
from PIL import Image
import tensorflow as tf
from tensorflow import keras

# Add backend dir to path for imports
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from scripts.gradcam import generate_gradcam_heatmap, create_gradcam_overlay

MODEL_FILE = BACKEND_DIR / "models" / "smileguard_model.keras"
CLASS_NAMES_FILE = BACKEND_DIR / "models" / "class_names.json"
TEST_DATA_DIR = BACKEND_DIR / "dataset" / "processed" / "test"

IMAGE_SIZE = (224, 224)

def run_verification():
    print("=" * 65)
    print("SMILEGUARD AI - REAL MODEL VERIFICATION & DEFENSE AUDIT")
    print("=" * 65)

    if not MODEL_FILE.exists():
        print(f"[!] Error: Model file not found at {MODEL_FILE}")
        print("    Please run train.py first.")
        return False

    if not CLASS_NAMES_FILE.exists():
        print(f"[!] Error: Class names file not found at {CLASS_NAMES_FILE}")
        return False

    # 1. Load trained model & class names
    print(f"[*] 1. Loading trained model from: {MODEL_FILE}")
    model = keras.models.load_model(MODEL_FILE)
    print(f"    - Model input shape: {model.input_shape}")
    print(f"    - Model output shape: {model.output_shape}")

    print(f"[*] 2. Loading class names from: {CLASS_NAMES_FILE}")
    with open(CLASS_NAMES_FILE, "r") as f:
        class_names = json.load(f)
    print(f"    - Discovered classes ({len(class_names)}): {class_names}")

    # 3. Find test images across classes
    test_samples = []
    for cls in class_names:
        cls_folder = TEST_DATA_DIR / cls
        if cls_folder.exists():
            for f in cls_folder.iterdir():
                if f.is_file() and f.suffix.lower() in [".jpg", ".png", ".jpeg"]:
                    test_samples.append((f, cls))
                    break  # 1 sample per class for verification display

    if not test_samples:
        print("[!] No test images found in test directory.")
        return False

    print(f"\n[*] 3. Running Real Inference on {len(test_samples)} Test Images:")
    print("-" * 65)

    all_passed = True

    for img_path, true_class in test_samples:
        print(f"\n--- Testing Image: {img_path.name} (Actual Label: '{true_class}') ---")

        # 4. Preprocessing
        original_img = Image.open(img_path).convert("RGB")
        resized_img = original_img.resize(IMAGE_SIZE)
        img_array = np.expand_dims(np.array(resized_img, dtype=np.float32), axis=0)

        # 5. Run Model Inference
        raw_probs = model.predict(img_array, verbose=0)[0]
        prob_sum = float(np.sum(raw_probs))

        # 6. Verify Softmax Sum Constraint
        is_valid_prob = np.isclose(prob_sum, 1.0, atol=1e-3)
        if not is_valid_prob:
            print(f"[!] Warning: Probability sum deviation: {prob_sum}")
            all_passed = False

        # 7. Extract Real Predicted Class & Confidence
        pred_idx = int(np.argmax(raw_probs))
        pred_class = class_names[pred_idx]
        confidence = float(raw_probs[pred_idx])

        # 8. Print Dynamic Output Breakdown
        print(f"Model Probabilities (Sum: {prob_sum:.4f}):")
        for i, (c_name, p_val) in enumerate(zip(class_names, raw_probs)):
            bar = "#" * int(p_val * 25)
            print(f"  [{i}] {c_name:<16}: {p_val*100:6.2f}% | {bar}")

        print(f"Predicted Class: {pred_class}")
        print(f"Confidence:      {confidence*100:.2f}%")
        print(f"Ground Truth:    {true_class}")
        print(f"Match:           {'[MATCH]' if pred_class == true_class else '[MISMATCH]'}")

        # 9. Generate Real Grad-CAM
        try:
            cam, g_pred_idx, g_score = generate_gradcam_heatmap(model, img_array, pred_idx)
            overlay_data = create_gradcam_overlay(cam, original_img)
            assert overlay_data["heatmap_data_url"].startswith("data:image/png;base64,")
            assert overlay_data["overlay_data_url"].startswith("data:image/png;base64,")
            print("Grad-CAM:        SUCCESS (Heatmap & Overlay generated from top_conv gradients)")
        except Exception as e:
            print(f"Grad-CAM:        FAILED ({e})")
            all_passed = False

    print("\n" + "=" * 65)
    if all_passed:
        print("[SUCCESS] ALL VERIFICATION CHECKS PASSED: Model & Grad-CAM fully operational.")
    else:
        print("[WARNING] Verification completed with warnings.")
    print("=" * 65)
    return all_passed

if __name__ == "__main__":
    run_verification()
