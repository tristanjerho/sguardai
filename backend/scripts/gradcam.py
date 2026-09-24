"""
SmileGuard AI - Mathematically Rigorous Grad-CAM Explainability Engine
Optimized for Low-Memory / Cloud Free-Tier Execution
"""

import base64
import io
import gc
from typing import Dict, Any, Tuple, Optional
import numpy as np
import cv2
from PIL import Image
import tensorflow as tf
from tensorflow import keras

_CACHED_GRADCAM_MODEL = None

def get_gradcam_extractor(model: keras.Model):
    global _CACHED_GRADCAM_MODEL
    if _CACHED_GRADCAM_MODEL is not None:
        return _CACHED_GRADCAM_MODEL

    try:
        base_model = model.get_layer("efficientnetb0")
        target_layer_name = "top_activation"
        try:
            target_layer = base_model.get_layer(target_layer_name)
        except ValueError:
            target_layer_name = "top_conv"
            target_layer = base_model.get_layer(target_layer_name)

        _CACHED_GRADCAM_MODEL = (
            keras.Model(
                inputs=base_model.inputs,
                outputs=target_layer.output,
                name="gradcam_conv_extractor"
            ),
            target_layer_name
        )
        return _CACHED_GRADCAM_MODEL
    except Exception as e:
        print(f"[!] Could not initialize Grad-CAM extractor: {e}")
        return None, None

def generate_gradcam_heatmap(
    model: keras.Model,
    img_array: np.ndarray,
    pred_index: Optional[int] = None
) -> Tuple[np.ndarray, int, float, str]:
    conv_feature_model, target_layer_name = get_gradcam_extractor(model)
    if conv_feature_model is None:
        raise ValueError("Grad-CAM feature extractor unavailable.")

    # Subsequent classification head layers
    avg_pool = model.get_layer("avg_pool")
    batch_norm = model.get_layer("batch_norm")
    dense_features = model.get_layer("dense_features")
    top_dropout = model.get_layer("top_dropout")
    predictions_layer = model.get_layer("predictions")

    W, b = predictions_layer.get_weights()

    if pred_index is None:
        full_softmax = model(img_array, training=False)
        pred_index = int(tf.argmax(full_softmax[0]))

    with tf.GradientTape() as tape:
        conv_outputs = conv_feature_model(img_array)
        tape.watch(conv_outputs)

        x = avg_pool(conv_outputs)
        x = batch_norm(x)
        x = dense_features(x)
        x = top_dropout(x, training=False)

        logits = tf.matmul(x, W) + b
        target_logit = logits[:, pred_index]

    grads = tape.gradient(target_logit, conv_outputs)
    if grads is None:
        raise ValueError(f"Could not compute gradients for target layer '{target_layer_name}'.")

    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
    conv_outputs_val = conv_outputs[0]
    cam = tf.reduce_sum(tf.multiply(pooled_grads, conv_outputs_val), axis=-1)

    cam = tf.maximum(cam, 0)
    max_val = tf.reduce_max(cam)
    if max_val > 0:
        cam = cam / max_val

    cam_np = cam.numpy()
    target_logit_val = float(target_logit[0].numpy())

    return cam_np, int(pred_index), target_logit_val, target_layer_name

def create_gradcam_overlay(
    heatmap: np.ndarray,
    original_pil_img: Image.Image,
    alpha: float = 0.50
) -> Dict[str, Any]:
    # Downscale high-resolution images to max 800px to protect memory on 512MB RAM
    max_dim = 800
    w, h = original_pil_img.size
    if max(w, h) > max_dim:
        scale = max_dim / float(max(w, h))
        new_w, new_h = int(w * scale), int(h * scale)
        pil_img_resized = original_pil_img.resize((new_w, new_h), Image.Resampling.BILINEAR)
    else:
        pil_img_resized = original_pil_img
        new_w, new_h = w, h

    orig_np = np.array(pil_img_resized.convert("RGB"))

    # Resize heatmap to match image dimensions
    resized_heatmap = cv2.resize(heatmap, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
    resized_heatmap = np.clip(resized_heatmap, 0.0, 1.0)
    heatmap_uint8 = np.uint8(255 * resized_heatmap)

    # Apply JET colormap
    colored_heatmap = cv2.applyColorMap(heatmap_uint8, cv2.COLORMAP_JET)
    colored_heatmap_rgb = cv2.cvtColor(colored_heatmap, cv2.COLOR_BGR2RGB)

    # Composite blended overlay
    overlay_rgb = cv2.addWeighted(orig_np, 1.0 - alpha, colored_heatmap_rgb, alpha, 0)

    # Encode as JPEG with quality 80 to minimize memory and bandwidth
    def to_b64_url(img_rgb_arr: np.ndarray) -> str:
        pil_res = Image.fromarray(img_rgb_arr)
        buf = io.BytesIO()
        pil_res.save(buf, format="JPEG", quality=80, optimize=True)
        b64_str = base64.b64encode(buf.getvalue()).decode("utf-8")
        return f"data:image/jpeg;base64,{b64_str}"

    heatmap_data_url = to_b64_url(colored_heatmap_rgb)
    overlay_data_url = to_b64_url(overlay_rgb)

    del orig_np, colored_heatmap, colored_heatmap_rgb, overlay_rgb
    gc.collect()

    return {
        "heatmap_data_url": heatmap_data_url,
        "overlay_data_url": overlay_data_url,
        "raw_heatmap": resized_heatmap,
        "original_dimensions": [w, h]
    }
