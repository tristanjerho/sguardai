import tensorflow as tf
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BACKEND_DIR / "models"

validator_keras = MODELS_DIR / "xray_validator.keras"
validator_tflite = MODELS_DIR / "xray_validator.tflite"

pathology_keras = MODELS_DIR / "smileguard_model.keras"
pathology_tflite = MODELS_DIR / "smileguard_model.tflite"

print("[*] Converting Stage 1 Validator model to TFLite...")
v_model = tf.keras.models.load_model(validator_keras, compile=False)
v_converter = tf.lite.TFLiteConverter.from_keras_model(v_model)
v_converter.optimizations = [tf.lite.Optimize.DEFAULT]
v_tflite = v_converter.convert()
with open(validator_tflite, "wb") as f:
    f.write(v_tflite)
print(f"[OK] Saved {validator_tflite} ({len(v_tflite) / (1024*1024):.2f} MB)")

print("[*] Converting Stage 2 Pathology model to TFLite...")
p_model = tf.keras.models.load_model(pathology_keras, compile=False)
p_converter = tf.lite.TFLiteConverter.from_keras_model(p_model)
p_converter.optimizations = [tf.lite.Optimize.DEFAULT]
p_tflite = p_converter.convert()
with open(pathology_tflite, "wb") as f:
    f.write(p_tflite)
print(f"[OK] Saved {pathology_tflite} ({len(p_tflite) / (1024*1024):.2f} MB)")
