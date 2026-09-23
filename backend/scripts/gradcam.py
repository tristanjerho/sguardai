"""
SmileGuard AI - Mathematically Rigorous Grad-CAM Explainability Engine
- Strictly adheres to the Grad-CAM formulation (Selvaraju et al., ICCV 2017)
- Computes genuine gradients from pre-softmax linear logits (eliminates softmax coupling)
- Targets the actual predicted class index dynamically: pred_index = argmax(probabilities)
- Extracts feature maps from top_activation / top_conv (7x7x1280) of EfficientNetB0
- Scales and blends pixel-aligned heatmaps preserving original image aspect ratio
- Zero hardcoded, fake, or synthetic heatmaps
"""

import base64
import io
from typing import Dict, Any, Tuple, Optional
import numpy as np
import cv2
from PIL import Image
import tensorflow as tf
from tensorflow import keras

def generate_gradcam_heatmap(
    model: keras.Model,
    img_array: np.ndarray,
    pred_index: Optional[int] = None
) -> Tuple[np.ndarray, int, float, str]:
    """
    Computes genuine Grad-CAM activation map using pre-softmax logits from the trained CNN.

    Args:
        model: Loaded Trained Keras model
        img_array: Preprocessed input tensor of shape (1, 224, 224, 3)
        pred_index: Target class index to explain. If None, dynamically uses argmax(probabilities)

    Returns:
        cam: 2D normalized numpy array (H_feat, W_feat) with values in [0.0, 1.0]
        target_class_idx: Integer index of target class
        target_logit: Pre-softmax logit value of the target class
        layer_name: Name of the convolutional target layer
    """
    # 1. Access the EfficientNetB0 backbone and final spatial activation layer
    base_model = model.get_layer("efficientnetb0")
    
    # In EfficientNetB0, 'top_activation' provides the post-ReLU/Swish 7x7x1280 spatial feature map
    target_layer_name = "top_activation"
    try:
        target_layer = base_model.get_layer(target_layer_name)
    except ValueError:
        target_layer_name = "top_conv"
        target_layer = base_model.get_layer(target_layer_name)

    # Sub-model mapping base_model input to target convolutional feature maps
    conv_feature_model = keras.Model(
        inputs=base_model.inputs,
        outputs=target_layer.output,
        name="gradcam_conv_extractor"
    )

    # Subsequent classification head layers
    avg_pool = model.get_layer("avg_pool")
    batch_norm = model.get_layer("batch_norm")
    dense_features = model.get_layer("dense_features")
    top_dropout = model.get_layer("top_dropout")
    predictions_layer = model.get_layer("predictions")

    # Extract dense weights W and bias b to calculate linear pre-softmax logits
    W, b = predictions_layer.get_weights()

    # 2. Determine target class index from model forward pass if not provided
    if pred_index is None:
        full_softmax = model(img_array, training=False)
        pred_index = int(tf.argmax(full_softmax[0]))

    # 3. Compute gradients of the target pre-softmax logit w.r.t. feature maps
    with tf.GradientTape() as tape:
        # Extract convolutional activations A: shape (1, 7, 7, 1280)
        conv_outputs = conv_feature_model(img_array)
        tape.watch(conv_outputs)

        # Forward through top classification layers
        x = avg_pool(conv_outputs)
        x = batch_norm(x)
        x = dense_features(x)
        x = top_dropout(x, training=False)

        # Compute pre-softmax linear logits: z = x @ W + b
        logits = tf.matmul(x, W) + b
        target_logit = logits[:, pred_index]

    # Gradient of target score y^c w.r.t. feature map activations A^k
    grads = tape.gradient(target_logit, conv_outputs)
    if grads is None:
        raise ValueError(f"Could not compute gradients for target layer '{target_layer_name}'.")

    # 4. Global Average Pooling of gradients: alpha_k = (1/Z) * sum_i sum_j (d y^c / d A_ij^k)
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))  # shape: (1280,)

    # 5. Weighted combination of feature maps: L_gradcam = ReLU( sum_k alpha_k * A^k )
    conv_outputs_val = conv_outputs[0]  # shape: (7, 7, 1280)
    cam = tf.reduce_sum(tf.multiply(pooled_grads, conv_outputs_val), axis=-1)  # shape: (7, 7)

    # 6. Apply ReLU: only positive features contributing to the target class
    cam = np.maximum(cam.numpy(), 0)

    # 7. Heatmap normalization [0, 1]
    max_val = np.max(cam)
    if max_val > 0:
        cam = cam / max_val
    else:
        cam = np.zeros_like(cam)

    return cam, int(pred_index), float(target_logit[0].numpy()), target_layer_name

def create_gradcam_overlay(
    heatmap: np.ndarray,
    original_pil_img: Image.Image,
    alpha: float = 0.50
) -> Dict[str, Any]:
    """
    Bilinearly interpolates heatmap to original image dimensions and blends with OpenCV JET colormap.

    Args:
        heatmap: 2D numpy array (H_feat, W_feat)
        original_pil_img: PIL Image in original aspect ratio and resolution
        alpha: Blending transparency factor (default 0.50)

    Returns:
        Dictionary containing base64 data URLs for pure heatmap and composite overlay
    """
    orig_np = np.array(original_pil_img.convert("RGB"))
    orig_h, orig_w = orig_np.shape[:2]

    # Resize heatmap with bicubic/bilinear interpolation to match exact original dimensions
    resized_heatmap = cv2.resize(heatmap, (orig_w, orig_h), interpolation=cv2.INTER_CUBIC)
    resized_heatmap = np.clip(resized_heatmap, 0.0, 1.0)

    # Convert to 0-255 uint8
    heatmap_uint8 = np.uint8(255 * resized_heatmap)

    # Apply JET colormap (blue = background, yellow/red = high model activation)
    colored_heatmap = cv2.applyColorMap(heatmap_uint8, cv2.COLORMAP_JET)
    colored_heatmap_rgb = cv2.cvtColor(colored_heatmap, cv2.COLOR_BGR2RGB)

    # Composite blended overlay
    overlay_rgb = cv2.addWeighted(orig_np, 1.0 - alpha, colored_heatmap_rgb, alpha, 0)

    def to_b64_url(img_rgb_arr: np.ndarray) -> str:
        pil_res = Image.fromarray(img_rgb_arr)
        buf = io.BytesIO()
        pil_res.save(buf, format="PNG")
        b64_str = base64.b64encode(buf.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{b64_str}"

    return {
        "heatmap_data_url": to_b64_url(colored_heatmap_rgb),
        "overlay_data_url": to_b64_url(overlay_rgb),
        "raw_heatmap": resized_heatmap,
        "original_dimensions": [orig_w, orig_h]
    }
