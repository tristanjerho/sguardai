"""
Dataset Preparation & Ingestion Pipeline for SmileGuard AI
- Audits source images from local Dental OPG X-ray dataset
- Verifies image integrity and ensures clean dataset splits
- Performs stratified Train (70%) / Val (15%) / Test (15%) split across all 6 diagnostic classes
- Generates clean dataset and summary metadata
"""

import os
import shutil
import hashlib
import json
import math
from pathlib import Path
from PIL import Image
from sklearn.model_selection import train_test_split

SOURCE_DATASET_DIR = Path(r"C:\Users\My Computer\Downloads\dental_dataset\Dental OPG XRAY Dataset\Dental OPG (Classification)")
BACKEND_DIR = Path(__file__).resolve().parent.parent
RAW_DATASET_DIR = BACKEND_DIR / "dataset" / "raw"
PROCESSED_DATASET_DIR = BACKEND_DIR / "dataset" / "processed"
SUMMARY_FILE = BACKEND_DIR / "dataset" / "dataset_summary.json"

VALID_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"}

def calculate_sha256(file_path: Path) -> str:
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(8192):
            hasher.update(chunk)
    return hasher.hexdigest()

def prepare_dataset():
    print(f"[*] Starting Dataset Audit from: {SOURCE_DATASET_DIR}")
    if not SOURCE_DATASET_DIR.exists():
        raise FileNotFoundError(f"Source dataset directory not found: {SOURCE_DATASET_DIR}")

    # Clean existing destination dirs if any
    if PROCESSED_DATASET_DIR.exists():
        shutil.rmtree(PROCESSED_DATASET_DIR)
    if RAW_DATASET_DIR.exists():
        shutil.rmtree(RAW_DATASET_DIR)

    # Discover classes
    classes = sorted([d.name for d in SOURCE_DATASET_DIR.iterdir() if d.is_dir()])
    print(f"[*] Discovered {len(classes)} classes: {classes}")

    # Prepare raw and processed directories
    RAW_DATASET_DIR.mkdir(parents=True, exist_ok=True)
    for split in ["train", "val", "test"]:
        for cls in classes:
            (PROCESSED_DATASET_DIR / split / cls).mkdir(parents=True, exist_ok=True)

    corrupted_files = []
    class_samples = {cls: [] for cls in classes}

    # Step 1: Scan, validate and copy raw dataset per class
    for cls in classes:
        cls_dir = SOURCE_DATASET_DIR / cls
        raw_cls_dir = RAW_DATASET_DIR / cls
        raw_cls_dir.mkdir(parents=True, exist_ok=True)

        seen_in_class = set()
        files = [f for f in cls_dir.iterdir() if f.is_file() and f.suffix.lower() in VALID_EXTENSIONS]

        for f in files:
            try:
                # Validate image integrity
                with Image.open(f) as img:
                    img.verify()
                with Image.open(f) as img:
                    width, height = img.size
                    if width < 32 or height < 32:
                        print(f"[!] Warning: Image too small ({width}x{height}): {f.name}")
                        corrupted_files.append(str(f))
                        continue

                # Check intra-class duplicate
                file_hash = calculate_sha256(f)
                if file_hash in seen_in_class:
                    print(f"[!] Intra-class duplicate skipped: {f.name} in {cls}")
                    continue
                seen_in_class.add(file_hash)

                # Copy to raw clean repository
                target_raw = raw_cls_dir / f.name
                shutil.copy2(f, target_raw)

                class_samples[cls].append({
                    "path": target_raw,
                    "class": cls,
                    "filename": f.name
                })
            except Exception as e:
                print(f"[!] Corrupt image encountered: {f} - Error: {e}")
                corrupted_files.append(str(f))

    total_valid = sum(len(samples) for samples in class_samples.values())
    print(f"\n[*] Audit Complete:")
    print(f"    - Total Valid Images: {total_valid}")
    print(f"    - Corrupted Files Discarded: {len(corrupted_files)}")
    for cls, samples in class_samples.items():
        print(f"    - {cls}: {len(samples)} valid images")

    # Step 2: Stratified Split Per Class (70% Train, 15% Val, 15% Test)
    train_samples = []
    val_samples = []
    test_samples = []
    class_distribution = {}

    for cls, samples in class_samples.items():
        n = len(samples)
        n_test = max(1, round(n * 0.15))
        n_val = max(1, round(n * 0.15))
        n_train = n - n_test - n_val

        # Ensure train gets at least 1
        if n_train < 1:
            n_train = 1
            if n_test > 1:
                n_test -= 1
            elif n_val > 1:
                n_val -= 1

        # Use deterministic shuffling with fixed seed 42
        train_cls, temp_cls = train_test_split(
            samples, test_size=(n_val + n_test), random_state=42
        )
        val_cls, test_cls = train_test_split(
            temp_cls, test_size=n_test, random_state=42
        )

        train_samples.extend(train_cls)
        val_samples.extend(val_cls)
        test_samples.extend(test_cls)

        class_distribution[cls] = {
            "train": len(train_cls),
            "val": len(val_cls),
            "test": len(test_cls),
            "total": n
        }

    # Step 3: Copy to processed split directories
    splits_data = {
        "train": train_samples,
        "val": val_samples,
        "test": test_samples
    }

    for split_name, samples in splits_data.items():
        for item in samples:
            src = item["path"]
            dst = PROCESSED_DATASET_DIR / split_name / item["class"] / item["filename"]
            shutil.copy2(src, dst)

    summary = {
        "total_valid_images": total_valid,
        "total_corrupted_filtered": len(corrupted_files),
        "num_classes": len(classes),
        "classes": classes,
        "class_to_idx": {cls: i for i, cls in enumerate(classes)},
        "splits": {
            "train_count": len(train_samples),
            "val_count": len(val_samples),
            "test_count": len(test_samples)
        },
        "class_distribution": class_distribution
    }

    with open(SUMMARY_FILE, "w") as f:
        json.dump(summary, f, indent=2)

    print("\n[*] Stratified Split Summary:")
    print(f"    - Train: {len(train_samples)} images ({len(train_samples)/total_valid:.1%})")
    print(f"    - Validation: {len(val_samples)} images ({len(val_samples)/total_valid:.1%})")
    print(f"    - Held-Out Test: {len(test_samples)} images ({len(test_samples)/total_valid:.1%})")
    print(f"[*] Dataset summary written to {SUMMARY_FILE}")

if __name__ == "__main__":
    prepare_dataset()
