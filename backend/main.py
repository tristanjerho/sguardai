"""
SmileGuard AI - Two-Stage Clinical Radiograph Diagnostic API
Stage 1: Real Dental OPG X-ray Validator CNN (Binary gatekeeper: OPG vs Non-OPG)
Stage 2: Real Dental Pathology CNN (6-class classification + Grad-CAM)
Strictly enforces Zero Fabrication: Non-OPG images are rejected with NO pathology predictions.
"""

import os
import io
import json
import base64
import urllib.request
import gc
from pathlib import Path
from typing import Optional, Dict, Any, List

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

import numpy as np
from PIL import Image
import cv2

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import tensorflow as tf
from tensorflow import keras

# Constrain thread allocations to prevent high RAM spikes on cloud free tiers
tf.config.threading.set_inter_op_parallelism_threads(1)
tf.config.threading.set_intra_op_parallelism_threads(1)

from scripts.gradcam import generate_gradcam_heatmap, create_gradcam_overlay

BACKEND_DIR = Path(__file__).resolve().parent

# Stage 2 (Pathology Model)
PATHOLOGY_MODEL_FILE = BACKEND_DIR / "models" / "smileguard_model.keras"
PATHOLOGY_TFLITE_FILE = BACKEND_DIR / "models" / "smileguard_model.tflite"
PATHOLOGY_CLASSES_FILE = BACKEND_DIR / "models" / "class_names.json"
PATHOLOGY_METADATA_FILE = BACKEND_DIR / "models" / "model_metadata.json"

# Stage 1 (Validator Model)
VALIDATOR_MODEL_FILE = BACKEND_DIR / "models" / "xray_validator.keras"
VALIDATOR_TFLITE_FILE = BACKEND_DIR / "models" / "xray_validator.tflite"
VALIDATOR_CLASSES_FILE = BACKEND_DIR / "models" / "xray_validator_classes.json"
VALIDATOR_METADATA_FILE = BACKEND_DIR / "models" / "xray_validator_metadata.json"

IMAGE_SIZE = (224, 224)

app = FastAPI(
    title="SmileGuard AI - Two-Stage Diagnostic API",
    version="2.0.0",
    description="Real two-stage deep learning inference: OPG validation gatekeeper followed by pathology classification."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
@app.head("/")
async def root():
    return {
        "status": "online",
        "service": "SmileGuard AI Diagnostic API",
        "version": "2.0.0"
    }

# Global models and interpreters
pathology_model = None
pathology_interpreter = None
pathology_classes = []
pathology_metadata = {}

validator_model = None
validator_interpreter = None
validator_classes = []
validator_metadata = {}
validation_threshold = 0.60

def run_tflite_predict(interpreter, input_tensor: np.ndarray) -> np.ndarray:
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    interpreter.set_tensor(input_details[0]['index'], input_tensor)
    interpreter.invoke()
    return interpreter.get_tensor(output_details[0]['index'])[0]

def load_resources():
    global pathology_model, pathology_interpreter, pathology_classes, pathology_metadata
    global validator_model, validator_interpreter, validator_classes, validator_metadata, validation_threshold

    # Load Stage 1 Validator (Prefer TFLite for low RAM)
    if VALIDATOR_TFLITE_FILE.exists() and validator_interpreter is None:
        try:
            print(f"[*] Loading Stage-1 TFLite Validator from {VALIDATOR_TFLITE_FILE}...")
            validator_interpreter = tf.lite.Interpreter(model_path=str(VALIDATOR_TFLITE_FILE))
            validator_interpreter.allocate_tensors()
            print("[OK] Stage-1 TFLite Validator loaded.")
        except Exception as e:
            print(f"[!] Warning: TFLite validator failed, falling back to Keras: {e}")

    if validator_model is None and validator_interpreter is None and VALIDATOR_MODEL_FILE.exists():
        print(f"[*] Loading Stage-1 Keras Validator from {VALIDATOR_MODEL_FILE}...")
        validator_model = keras.models.load_model(VALIDATOR_MODEL_FILE, compile=False)
        print("[OK] Stage-1 Keras Validator loaded.")

    if VALIDATOR_CLASSES_FILE.exists() and not validator_classes:
        with open(VALIDATOR_CLASSES_FILE, "r") as f:
            validator_classes = json.load(f)

    if VALIDATOR_METADATA_FILE.exists():
        with open(VALIDATOR_METADATA_FILE, "r") as f:
            validator_metadata = json.load(f)
            validation_threshold = float(validator_metadata.get("validation_decision_threshold", 0.60))
        print(f"[OK] Validator threshold established at: {validation_threshold}")

    # Load Stage 2 Pathology (Prefer TFLite for inference)
    if PATHOLOGY_TFLITE_FILE.exists() and pathology_interpreter is None:
        try:
            print(f"[*] Loading Stage-2 TFLite Pathology from {PATHOLOGY_TFLITE_FILE}...")
            pathology_interpreter = tf.lite.Interpreter(model_path=str(PATHOLOGY_TFLITE_FILE))
            pathology_interpreter.allocate_tensors()
            print("[OK] Stage-2 TFLite Pathology model loaded.")
        except Exception as e:
            print(f"[!] Warning: TFLite pathology failed: {e}")

    if PATHOLOGY_MODEL_FILE.exists() and pathology_model is None:
        try:
            print(f"[*] Loading Stage-2 Keras Pathology from {PATHOLOGY_MODEL_FILE}...")
            pathology_model = keras.models.load_model(PATHOLOGY_MODEL_FILE, compile=False)
            print("[OK] Stage-2 Keras Pathology model loaded.")
        except Exception as e:
            print(f"[!] Warning: Keras model load skipped: {e}")

    if PATHOLOGY_CLASSES_FILE.exists() and not pathology_classes:
        with open(PATHOLOGY_CLASSES_FILE, "r") as f:
            pathology_classes = json.load(f)
        print(f"[OK] Loaded {len(pathology_classes)} pathology classes: {pathology_classes}")

    if PATHOLOGY_METADATA_FILE.exists():
        with open(PATHOLOGY_METADATA_FILE, "r") as f:
            pathology_metadata = json.load(f)

@app.on_event("startup")
async def startup_event():
    load_resources()

class UrlPredictRequest(BaseModel):
    imageUrl: Optional[str] = None

    imageBase64: Optional[str] = None
    patientId: Optional[str] = None
    radiographType: Optional[str] = "OPG"

def preprocess_pil_image(pil_img: Image.Image) -> np.ndarray:
    rgb_img = pil_img.convert("RGB")
    resized_img = rgb_img.resize(IMAGE_SIZE)
    img_array = np.expand_dims(np.array(resized_img, dtype=np.float32), axis=0)
    return img_array

def process_and_infer(pil_img: Image.Image, source_name: str = "Uploaded Image") -> Dict[str, Any]:
    global pathology_model, pathology_interpreter, pathology_classes, pathology_metadata
    global validator_model, validator_interpreter, validator_classes, validator_metadata, validation_threshold

    if (validator_model is None and validator_interpreter is None) or (pathology_model is None and pathology_interpreter is None):
        load_resources()

    if (validator_model is None and validator_interpreter is None) or (pathology_model is None and pathology_interpreter is None):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "MODEL_UNAVAILABLE",
                "message": "AI model weights are currently unavailable. Ensure both validator and pathology models are trained."
            }
        )

    # Preprocess
    img_array = preprocess_pil_image(pil_img)

    # ==========================================================
    # STAGE 1: REAL DENTAL OPG X-RAY VALIDATOR
    # ==========================================================
    print(f"\n[XRAY VALIDATOR] Image received: {source_name}")
    try:
        if validator_interpreter is not None:
            val_probs = run_tflite_predict(validator_interpreter, img_array)
        else:
            val_probs = validator_model.predict(img_array, verbose=0)[0]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "VALIDATOR_INFERENCE_ERROR", "message": f"Validator failed: {str(e)}"}
        )

    opg_idx = validator_classes.index("dental_opg") if "dental_opg" in validator_classes else 0
    opg_prob = float(val_probs[opg_idx])
    non_opg_prob = float(1.0 - opg_prob)
    is_valid_xray = bool(opg_prob >= validation_threshold)

    print(f"[XRAY VALIDATOR] Dental OPG probability: {opg_prob*100:.2f}% (Threshold: {validation_threshold*100:.1f}%)")
    print(f"[XRAY VALIDATOR] Validation result: {'PASS' if is_valid_xray else 'FAIL'}")

    # ==========================================================
    # REJECTION BRANCH: STOP PIPELINE IF NOT DENTAL OPG
    # ==========================================================
    if not is_valid_xray:
        print("[PATHOLOGY MODEL] SKIPPED (Non-OPG image detected)")
        print("[GRAD-CAM] SKIPPED")
        return {
            "success": False,
            "status": "invalid_xray",
            "error": "INVALID_XRAY_IMAGE",
            "message": "The uploaded image does not appear to be a valid dental panoramic (OPG) radiograph. Pathology classification has been halted.",
            "xray_validation": {
                "is_valid": False,
                "confidence": round(non_opg_prob * 100, 2),
                "opg_probability": round(opg_prob, 4),
                "threshold_applied": validation_threshold,
                "detected_type": "Non-Dental-OPG Image"
            }
        }

    # ==========================================================
    # STAGE 2: REAL DENTAL PATHOLOGY CLASSIFICATION
    # ==========================================================
    print("[PATHOLOGY MODEL] Running clinical inference...")
    try:
        if pathology_interpreter is not None:
            pathology_probs = run_tflite_predict(pathology_interpreter, img_array)
        else:
            pathology_probs = pathology_model.predict(img_array, verbose=0)[0]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "PATHOLOGY_INFERENCE_ERROR", "message": f"Pathology inference failed: {str(e)}"}
        )

    pred_idx = int(np.argmax(pathology_probs))
    pred_class = pathology_classes[pred_idx]
    confidence = float(pathology_probs[pred_idx])


    print(f"[PATHOLOGY MODEL] Predicted class: {pred_class} (Confidence: {confidence*100:.2f}%)")

    probabilities_map = {}
    ranked_predictions = []
    for idx, (c_name, p_val) in enumerate(zip(pathology_classes, pathology_probs)):
        prob_f = float(p_val)
        probabilities_map[c_name] = round(prob_f, 4)
        ranked_predictions.append({
            "class": c_name,
            "probability": round(prob_f, 4),
            "percentage": round(prob_f * 100, 2)
        })

    ranked_predictions.sort(key=lambda x: x["probability"], reverse=True)

    # ==========================================================
    # GRAD-CAM GENERATION (ONLY FOR VALID OPG RADIOGRAPHS)
    # ==========================================================
    print(f"[GRAD-CAM] Generating Grad-CAM for predicted class '{pred_class}' (idx: {pred_idx})...")
    heatmap_url = None
    overlay_url = None
    target_layer_used = "top_activation"

    try:
        cam, g_pred_idx, g_logit, target_layer_used = generate_gradcam_heatmap(pathology_model, img_array, pred_idx)
        overlay_dict = create_gradcam_overlay(cam, pil_img)
        heatmap_url = overlay_dict["heatmap_data_url"]
        overlay_url = overlay_dict["overlay_data_url"]
        print(f"[GRAD-CAM] Success (Target Layer: '{target_layer_used}', Pre-softmax Logit: {g_logit:.4f})")
    except Exception as e:
        print(f"[!] Warning: Grad-CAM generation failed: {e}")
        heatmap_url = None
        overlay_url = None

    descriptions = {
        "Healthy Teeth": "Normal anatomical radiopacity. No definitive evidence of active carious demineralization or periapical lucencies.",
        "Caries": "Radiolucent area detected corresponding to enamel/dentin demineralization characteristic of dental caries.",
        "Impacted teeth": "Abnormal angulation/positioning preventing physiological eruption (e.g. 3rd molar impaction).",
        "BDC-BDR": "Severe coronal destruction and retained root fragments requiring surgical/endodontic evaluation.",
        "Infection": "Periapical radiolucency / apical periodontitis indicating inflammatory bone resorption or periapical abscess.",
        "Fractured Teeth": "Structural discontinuity / hairline fracture line observed across crown or root structure."
    }

    return {
        "success": True,
        "status": "success",
        "xray_validation": {
            "is_valid": True,
            "confidence": round(opg_prob * 100, 2),
            "opg_probability": round(opg_prob, 4),
            "threshold_applied": validation_threshold,
            "detected_type": "Dental OPG X-ray"
        },
        "prediction": {
            "class": pred_class,
            "confidence": round(confidence, 4),
            "confidence_percentage": round(confidence * 100, 2)
        },
        "probabilities": probabilities_map,
        "ranked_predictions": ranked_predictions,
        "gradcam": {
            "heatmapUrl": heatmap_url,
            "overlayUrl": overlay_url,
            "targetLayer": target_layer_used,
            "targetClass": pred_class,
            "targetClassIndex": pred_idx,
            "available": heatmap_url is not None
        },
        "findings": [
            {
                "condition": pred_class,
                "confidence": round(confidence * 100, 2),
                "description": descriptions.get(pred_class, f"Diagnosed with {pred_class} based on deep learning feature analysis.")
            }
        ],
        "observations": f"Verified Dental OPG. Trained CNN classifies radiograph as '{pred_class}' with {round(confidence*100, 1)}% confidence across {len(pathology_classes)} clinical categories.",
        "model": {
            "name": pathology_metadata.get("model_name", "SmileGuard EfficientNetB0"),
            "architecture": pathology_metadata.get("architecture", "EfficientNetB0"),
            "validator_architecture": validator_metadata.get("architecture", "EfficientNetB0 Validator"),
            "test_accuracy": pathology_metadata.get("evaluation", {}).get("test_accuracy")
        }
    }

@app.post("/api/predict")
async def predict_endpoint(
    file: Optional[UploadFile] = File(None),
    imageUrl: Optional[str] = Form(None),
    patientId: Optional[str] = Form(None),
    radiographType: Optional[str] = Form("OPG")
):
    pil_img = None
    source_name = "Uploaded File"

    if file is not None:
        source_name = file.filename
        try:
            contents = await file.read()
            pil_img = Image.open(io.BytesIO(contents))
            pil_img.verify()
            pil_img = Image.open(io.BytesIO(contents))
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_IMAGE", "message": f"Could not decode image file: {str(e)}"}
            )
    elif imageUrl:
        source_name = imageUrl
        try:
            req = urllib.request.Request(
                imageUrl,
                headers={"User-Agent": "SmileGuard-AI-Diagnostic/2.0"}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                contents = resp.read()
            pil_img = Image.open(io.BytesIO(contents))
            pil_img.verify()
            pil_img = Image.open(io.BytesIO(contents))
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_IMAGE_URL", "message": f"Failed to fetch image from URL: {str(e)}"}
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "MISSING_IMAGE", "message": "Either image file upload or imageUrl must be provided."}
        )

    return process_and_infer(pil_img, source_name=source_name)

@app.post("/api/predict-json")
async def predict_json_endpoint(req: UrlPredictRequest):
    if req.imageBase64:
        try:
            b64_data = req.imageBase64
            if "," in b64_data:
                b64_data = b64_data.split(",", 1)[1]
            img_bytes = base64.b64decode(b64_data)
            pil_img = Image.open(io.BytesIO(img_bytes))
            pil_img.verify()
            pil_img = Image.open(io.BytesIO(img_bytes))
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_BASE64_IMAGE", "message": f"Invalid base64 payload: {str(e)}"}
            )
    elif req.imageUrl:
        try:
            http_req = urllib.request.Request(
                req.imageUrl,
                headers={"User-Agent": "SmileGuard-AI-Diagnostic/2.0"}
            )
            with urllib.request.urlopen(http_req, timeout=10) as resp:
                contents = resp.read()
            pil_img = Image.open(io.BytesIO(contents))
            pil_img.verify()
            pil_img = Image.open(io.BytesIO(contents))
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_IMAGE_URL", "message": f"Failed to fetch image from URL: {str(e)}"}
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "MISSING_IMAGE", "message": "Either imageUrl or imageBase64 is required."}
        )

    return process_and_infer(pil_img, source_name="JSON Payload Image")

@app.get("/api/model-info")
async def get_model_info():
    global pathology_metadata, validator_metadata
    if not pathology_metadata and PATHOLOGY_METADATA_FILE.exists():
        with open(PATHOLOGY_METADATA_FILE, "r") as f:
            pathology_metadata = json.load(f)

    if not validator_metadata and VALIDATOR_METADATA_FILE.exists():
        with open(VALIDATOR_METADATA_FILE, "r") as f:
            validator_metadata = json.load(f)

    return {
        "status": "ready",
        "pipeline": "Two-Stage AI Diagnostic (Stage 1 Validator + Stage 2 Pathology)",
        "validator": validator_metadata,
        "pathology": pathology_metadata
    }

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "SmileGuard AI Two-Stage Diagnostic API",
        "validator_loaded": validator_model is not None,
        "pathology_loaded": pathology_model is not None,
        "classes_count": len(pathology_classes)
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

