"""
Two-Stage AI Diagnostic System Verification Suite
Tests the complete end-to-end pipeline:
- Validates that real Dental OPG radiographs pass Stage 1 and produce authentic Stage 2 predictions + Grad-CAM.
- Validates that non-OPG images (photos, documents, screenshots, objects) are REJECTED by Stage 1 with NO pathology predictions or Grad-CAM.
"""

import os
import sys
import glob
from pathlib import Path
from PIL import Image
import numpy as np
import requests

BACKEND_DIR = Path(__file__).resolve().parent.parent
API_URL = "http://127.0.0.1:8000/api/predict"

def run_tests():
    print("=" * 65)
    print("SMILEGUARD AI - TWO-STAGE AI DEFENSE VERIFICATION SUITE")
    print("=" * 65)

    # 1. Health check
    try:
        r_health = requests.get("http://127.0.0.1:8000/api/health", timeout=5)
        print(f"[*] API Health: {r_health.status_code} - {r_health.json()}")
    except Exception as e:
        print(f"[!] Error connecting to API: {e}")
        return False

    # Find sample test images
    opg_test_samples = glob.glob(str(BACKEND_DIR / "dataset" / "processed" / "test" / "*" / "*.jpg"))
    non_opg_test_samples = glob.glob(str(BACKEND_DIR / "xray_validation_dataset" / "test" / "non_opg" / "*.*"))

    if not opg_test_samples:
        print("[!] No OPG test samples found.")
        return False
    if not non_opg_test_samples:
        print("[!] No non-OPG test samples found.")
        return False

    print(f"[*] Discovered {len(opg_test_samples)} OPG test images and {len(non_opg_test_samples)} non-OPG test images.")

    all_tests_passed = True

    # ==========================================================
    # TEST 1: REAL DENTAL OPG X-RAY (MUST PASS)
    # ==========================================================
    print("\n" + "-" * 65)
    print("TEST 1: Real Dental Panoramic OPG Radiograph")
    print("-" * 65)
    sample_opg = opg_test_samples[0]
    print(f"Uploading OPG: {Path(sample_opg).name}...")

    with open(sample_opg, "rb") as f:
        r = requests.post(API_URL, files={"file": (Path(sample_opg).name, f, "image/jpeg")})

    res = r.json()
    print(f"Response Status: {r.status_code}")
    print(f"Stage 1 Validation: is_valid = {res.get('xray_validation', {}).get('is_valid')} (OPG Prob: {res.get('xray_validation', {}).get('opg_probability')})")
    
    if res.get("xray_validation", {}).get("is_valid") is True:
        print("  -> Stage 1 Result: PASS [CORRECT]")
    else:
        print("  -> Stage 1 Result: FAIL [UNEXPECTED]")
        all_tests_passed = False

    print(f"Stage 2 Pathology Prediction: {res.get('prediction')}")
    print(f"Grad-CAM Generated: {res.get('gradcam', {}).get('available')}")

    if res.get("prediction") and res.get("gradcam", {}).get("available"):
        print("  -> Stage 2 Result: SUCCESSFUL REAL INFERENCE [CORRECT]")
    else:
        print("  -> Stage 2 Result: MISSING PREDICTION [UNEXPECTED]")
        all_tests_passed = False

    # ==========================================================
    # TEST 2: REAL NON-OPG PHOTOGRAPH (MUST BE REJECTED)
    # ==========================================================
    print("\n" + "-" * 65)
    print("TEST 2: Real Non-OPG Photograph / Screenshot / Document")
    print("-" * 65)
    sample_non_opg = non_opg_test_samples[0]
    print(f"Uploading Non-OPG: {Path(sample_non_opg).name}...")

    with open(sample_non_opg, "rb") as f:
        r = requests.post(API_URL, files={"file": (Path(sample_non_opg).name, f, "image/jpeg")})

    res = r.json()
    print(f"Response Status: {r.status_code}")
    print(f"Stage 1 Validation: is_valid = {res.get('xray_validation', {}).get('is_valid')} (Confidence: {res.get('xray_validation', {}).get('confidence')}%)")
    print(f"Error Code: {res.get('error')} | Message: {res.get('message')}")

    if res.get("xray_validation", {}).get("is_valid") is False and res.get("error") == "INVALID_XRAY_IMAGE":
        print("  -> Stage 1 Rejection: PASS [CORRECT - NON-OPG BLOCKED]")
    else:
        print("  -> Stage 1 Rejection: FAILED (Non-OPG was mistakenly accepted) [CRITICAL BUG]")
        all_tests_passed = False

    # Verify that NO pathology predictions or Grad-CAM were returned
    has_pathology = "prediction" in res or "probabilities" in res or "findings" in res
    has_gradcam = res.get("gradcam", {}).get("available", False)

    if not has_pathology and not has_gradcam:
        print("  -> Zero Fabrication Guard: PASS (No pathology or Grad-CAM generated for invalid image) [CORRECT]")
    else:
        print("  -> Zero Fabrication Guard: FAIL (Pathology result was generated for non-OPG) [CRITICAL BUG]")
        all_tests_passed = False

    # ==========================================================
    # TEST 3: SECOND NON-OPG TEST SAMPLE
    # ==========================================================
    if len(non_opg_test_samples) > 1:
        print("\n" + "-" * 65)
        print("TEST 3: Second Non-OPG Test Image")
        print("-" * 65)
        sample_non_opg_2 = non_opg_test_samples[1]
        print(f"Uploading Non-OPG: {Path(sample_non_opg_2).name}...")

        with open(sample_non_opg_2, "rb") as f:
            r = requests.post(API_URL, files={"file": (Path(sample_non_opg_2).name, f, "image/jpeg")})

        res = r.json()
        print(f"Stage 1 Validation: is_valid = {res.get('xray_validation', {}).get('is_valid')}")
        if res.get("xray_validation", {}).get("is_valid") is False:
            print("  -> Non-OPG Blocked: PASS [CORRECT]")
        else:
            print("  -> Non-OPG Blocked: FAIL [CRITICAL BUG]")
            all_tests_passed = False

    print("\n" + "=" * 65)
    if all_tests_passed:
        print("[SUCCESS] ALL TWO-STAGE PIPELINE DEFENSE TESTS PASSED!")
    else:
        print("[WARNING] One or more tests failed.")
    print("=" * 65)
    return all_tests_passed

if __name__ == "__main__":
    run_tests()
