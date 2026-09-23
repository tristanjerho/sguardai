"""
Dataset Preparation & Audit for Stage 1: Dental OPG X-ray Validator
- Positive class: Real panoramic dental X-rays from the local OPG dataset
- Negative class: Real non-OPG images (photographs, documents, screenshots, natural scenes)
- SHA-256 duplicate detection & integrity verification
- Stratified Train (70%) / Val (15%) / Test (15%) split
- Generates backend/reports/xray_validation_dataset_audit.json
"""

import os
import glob
import shutil
import hashlib
import json
from pathlib import Path
from PIL import Image
from sklearn.model_selection import train_test_split

BACKEND_DIR = Path(__file__).resolve().parent.parent
OPG_SOURCE_DIR = BACKEND_DIR / "dataset" / "raw"
VALIDATOR_DS_DIR = BACKEND_DIR / "xray_validation_dataset"
REPORTS_DIR = BACKEND_DIR / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
AUDIT_FILE = REPORTS_DIR / "xray_validation_dataset_audit.json"

VALID_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

def calculate_sha256(file_path: Path) -> str:
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(8192):
            hasher.update(chunk)
    return hasher.hexdigest()

def collect_non_opg_sources():
    """
    Discovers real non-OPG images from user downloads, pictures, and system wallpapers.
    """
    candidates = []
    
    # 1. Downloads (non-dental)
    d_dir = Path(r"C:\Users\My Computer\Downloads")
    if d_dir.exists():
        for root, dirs, files in os.walk(d_dir):
            if "dental" in root.lower() or "opg" in root.lower():
                continue
            for f in files:
                p = Path(root) / f
                if p.suffix.lower() in VALID_EXTENSIONS:
                    candidates.append(p)

    # 2. Pictures
    p_dir = Path(r"C:\Users\My Computer\Pictures")
    if p_dir.exists():
        for root, dirs, files in os.walk(p_dir):
            for f in files:
                p = Path(root) / f
                if p.suffix.lower() in VALID_EXTENSIONS:
                    candidates.append(p)

    # 3. OneDrive Pictures
    op_dir = Path(r"C:\Users\My Computer\OneDrive\Pictures")
    if op_dir.exists():
        for root, dirs, files in os.walk(op_dir):
            for f in files:
                p = Path(root) / f
                if p.suffix.lower() in VALID_EXTENSIONS:
                    candidates.append(p)

    # 4. Windows Web Wallpapers/Photos
    w_dir = Path(r"C:\Windows\Web")
    if w_dir.exists():
        for root, dirs, files in os.walk(w_dir):
            for f in files:
                p = Path(root) / f
                if p.suffix.lower() in VALID_EXTENSIONS:
                    candidates.append(p)

    return candidates

def prepare_validator_dataset():
    print("=" * 60)
    print("PREPARING STAGE 1: X-RAY VALIDATION DATASET")
    print("=" * 60)

    # Clean existing
    if VALIDATOR_DS_DIR.exists():
        shutil.rmtree(VALIDATOR_DS_DIR)

    classes = ["dental_opg", "non_opg"]
    for split in ["train", "val", "test"]:
        for cls in classes:
            (VALIDATOR_DS_DIR / split / cls).mkdir(parents=True, exist_ok=True)

    # 1. Collect Dental OPG Images
    print("[*] Collecting Dental OPG images...")
    opg_files = []
    for root, dirs, files in os.walk(OPG_SOURCE_DIR):
        for f in files:
            p = Path(root) / f
            if p.suffix.lower() in VALID_EXTENSIONS:
                opg_files.append(p)

    print(f"    - Found {len(opg_files)} Dental OPG source images.")

    # 2. Collect Non-OPG Images
    print("[*] Collecting Non-OPG real images...")
    non_opg_candidates = collect_non_opg_sources()
    print(f"    - Found {len(non_opg_candidates)} Non-OPG candidate images.")

    # Validate & Deduplicate OPG
    seen_opg_hashes = set()
    valid_opg_samples = []
    for f in opg_files:
        try:
            with Image.open(f) as img:
                img.verify()
            with Image.open(f) as img:
                w, h = img.size
                if w < 32 or h < 32:
                    continue
            h_val = calculate_sha256(f)
            if h_val in seen_opg_hashes:
                continue
            seen_opg_hashes.add(h_val)
            valid_opg_samples.append(f)
        except Exception:
            continue

    # Validate & Deduplicate Non-OPG
    seen_non_hashes = set()
    valid_non_samples = []
    for f in non_opg_candidates:
        try:
            with Image.open(f) as img:
                img.verify()
            with Image.open(f) as img:
                w, h = img.size
                if w < 32 or h < 32:
                    continue
            h_val = calculate_sha256(f)
            if h_val in seen_non_hashes or h_val in seen_opg_hashes:
                continue
            seen_non_hashes.add(h_val)
            valid_non_samples.append(f)
        except Exception:
            continue

    # Balance datasets: match counts (e.g. 500 OPG vs 500 Non-OPG)
    target_count = min(len(valid_opg_samples), len(valid_non_samples))
    selected_opg = valid_opg_samples[:target_count]
    selected_non = valid_non_samples[:target_count]

    print(f"\n[*] Filtered & Balanced Samples:")
    print(f"    - Dental OPG Samples: {len(selected_opg)}")
    print(f"    - Non-OPG Samples:    {len(selected_non)}")
    print(f"    - Total Validation Dataset: {len(selected_opg) + len(selected_non)}")

    # Stratified Split
    all_samples = [(p, "dental_opg") for p in selected_opg] + [(p, "non_opg") for p in selected_non]
    y = [s[1] for s in all_samples]

    train_data, temp_data, y_train, y_temp = train_test_split(
        all_samples, y, test_size=0.30, random_state=42, stratify=y
    )
    val_data, test_data, y_val, y_test = train_test_split(
        temp_data, y_temp, test_size=0.50, random_state=42, stratify=y_temp
    )

    splits = {
        "train": train_data,
        "val": val_data,
        "test": test_data
    }

    counts = {
        "train": {"dental_opg": 0, "non_opg": 0},
        "val": {"dental_opg": 0, "non_opg": 0},
        "test": {"dental_opg": 0, "non_opg": 0}
    }

    for split_name, items in splits.items():
        for idx, (src_path, label) in enumerate(items):
            ext = src_path.suffix.lower()
            dst = VALIDATOR_DS_DIR / split_name / label / f"{label}_{idx}{ext}"
            shutil.copy2(src_path, dst)
            counts[split_name][label] += 1

    audit_report = {
        "purpose": "Binary Dental OPG Input Validation Model",
        "classes": ["dental_opg", "non_opg"],
        "class_labels": {
            "dental_opg": "Dental OPG X-ray",
            "non_opg": "Non-Dental-OPG Image"
        },
        "sources": {
            "dental_opg": "Dental OPG Panoramic Radiograph Dataset",
            "non_opg": "Real-world photographs, documents, screenshots, objects, and system images"
        },
        "total_images": len(all_samples),
        "split_counts": counts,
        "proportions": {
            "train": f"{len(train_data)/len(all_samples):.1%}",
            "val": f"{len(val_data)/len(all_samples):.1%}",
            "test": f"{len(test_data)/len(all_samples):.1%}"
        }
    }

    with open(AUDIT_FILE, "w") as f:
        json.dump(audit_report, f, indent=2)

    print(f"\n[*] Audit report saved to {AUDIT_FILE}")
    print(f"[*] Train: {len(train_data)} images | Val: {len(val_data)} images | Test: {len(test_data)} images")
    print("=" * 60)

if __name__ == "__main__":
    prepare_validator_dataset()
