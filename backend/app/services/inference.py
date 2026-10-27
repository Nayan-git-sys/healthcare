"""Image validation, decode, preprocessing, inference, and Grad-CAM rendering."""
import base64
import io
import time
from pathlib import PurePosixPath

import numpy as np
import torch
from PIL import Image

from ..schemas import ClassScore
from .gradcam import GradCAM
from .model_runtime import ModelNotConfigured, runtime

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
_FILE_MAGIC = (b"\x89PNG\r\n\x1a\n", b"\xff\xd8\xff")   # PNG, JPEG/JFIF/EXIF


class InvalidImageError(ValueError):
    pass


class InferenceFailure(RuntimeError):
    pass


# jet-style colormap with a medical palette (navy -> blue -> teal -> yellow -> red)
_CAM_STOPS = np.array([
    [15, 32, 110],     # deep navy   (least attention)
    [46, 108, 255],    # blue
    [2, 191, 191],     # teal
    [255, 211, 0],     # yellow
    [235, 57, 57],     # red         (most attention)
], dtype=np.float32) / 255.0


def _apply_colormap(gray01: np.ndarray) -> np.ndarray:
    """Map a [H,W] float image in [0,1] to an [H,W,3] RGB image via a LUT."""
    n = len(_CAM_STOPS) - 1
    pos = np.clip(np.asarray(gray01, dtype=np.float32), 0.0, 1.0) * n
    idx = np.clip(pos.astype(int), 0, n - 1)
    frac = pos[:, :, None] - idx[:, :, None]
    return _CAM_STOPS[idx] * (1 - frac) + _CAM_STOPS[idx + 1] * frac


def validate_upload(data: bytes, filename: str) -> None:
    """Byte-level validation. Raises InvalidImageError with a user-facing message."""
    if not filename:
        raise InvalidImageError("A file must be selected.")
    ext = PurePosixPath(filename.lower()).suffix
    if ext not in (".png", ".jpg", ".jpeg"):
        raise InvalidImageError(
            f"Unsupported file type '{ext}'. Only .png and .jpg/.jpeg images are accepted.")
    if len(data) == 0:
        raise InvalidImageError("The uploaded file is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise InvalidImageError(
            f"File is {len(data)/1e6:.1f} MB; the limit is 10 MB.")
    if not any(data.startswith(m) for m in _FILE_MAGIC):
        raise InvalidImageError(
            "The file does not look like a PNG or JPEG image "
            "(its bytes do not start with a PNG/JPEG signature).")


def decode_image(data: bytes) -> Image.Image:
    """Decode strictly through PIL and convert to grayscale ('L')."""
    try:
        img = Image.open(io.BytesIO(data))
        img.load()                      # forces full decode, catches truncation
        if min(img.size) < 32 or max(img.size) > 8000:
            raise InvalidImageError(
                f"Image dimensions {img.size} are outside the supported range "
                f"(each side must be 32..8000 px).")
        return img.convert("L")
    except InvalidImageError:
        raise
    except Exception as e:  # PIL.UnidentifiedImageError, OSError, DecompressionBomb
        raise InferenceFailure(
            "The image could not be decoded; it may be corrupt or truncated.") from e


def preprocess(img: Image.Image) -> torch.Tensor:
    """Apply the exact preprocessing used at training time.

    Training-time images were decoded to grayscale, resized to
    meta.image_size (bilinear), scaled to [0,1], then normalized with the
    train-set channel statistics stored in the checkpoint.
    """
    meta = runtime.describe()
    size = int(meta["image_size"])
    norm = meta["normalize"]
    x = img.resize((size, size), Image.BILINEAR)
    arr = np.asarray(x, dtype=np.float32) / 255.0     # [H,W] in [0,1]
    mean, std = float(norm["mean"][0]), float(norm["std"][0])
    arr = (arr - mean) / std
    tensor = torch.from_numpy(arr.astype(np.float32))[None, None]   # [1,1,H,W]
    return tensor


def run_inference(img: Image.Image) -> dict:
    """Full inference: preprocessing -> forward -> softmax scores -> Grad-CAM.

    Returns a dict ready for the AnalyzeResponse schema. NEVER invents
    outputs; every failure raises so the API can report an honest error.
    """
    if runtime.model is None:
        raise ModelNotConfigured(
            "AI model not configured: trained checkpoint is missing. "
            "Train backend/models/best_model.pth with `python -m training.train`.")

    meta = runtime.describe()
    t0 = time.perf_counter()
    tensor = preprocess(img)
    probs_np = None
    with torch.inference_mode():
        logits = runtime.model(tensor)
        probs = torch.softmax(logits, dim=1)[0]
    probs_np = probs.cpu().numpy()
    inference_ms = int((time.perf_counter() - t0) * 1000)

    classes = meta["classes"]
    scores = [ClassScore(label=c, score=round(float(p), 4))
              for c, p in zip(classes, probs_np)]
    pred_idx = int(np.argmax(probs_np))

    # Grad-CAM on the predicted class
    t1 = time.perf_counter()
    gradcam = GradCAM(runtime.model, runtime.model.get_gradcam_target(),
                      name="")   # empty -> use the layer's descriptive _gradcam_name
    try:
        # gradients need grad-enabled forward; run a second pass for CAM
        input_leaf = tensor.clone().requires_grad_(True)
        cam = gradcam.generate(input_leaf, pred_idx)
    finally:
        gradcam.close()
    gradcam_ms = int((time.perf_counter() - t1) * 1000)

    return {
        "predicted_class_idx": pred_idx,
        "predicted_class": classes[pred_idx],
        "scores": scores,
        "cam": cam,
        "gradcam_target_layer": gradcam.name,
        "inference_ms": inference_ms,
        "gradcam_ms": gradcam_ms,
        "model": meta,
    }


def render_outputs(img: Image.Image, cam: np.ndarray,
                   alpha: float = 0.40, max_side: int = 768) -> dict:
    """Build original PNG and heatmap-overlay PNG data-URLs for the frontend."""
    # heatmap resized to the FULL original image dimensions, then capped for transport
    cam_im = Image.fromarray((np.clip(cam, 0, 1) * 255).astype(np.uint8), mode="L")
    cam_full = cam_im.resize(img.size, Image.BILINEAR)
    cam_rgb = _apply_colormap(np.asarray(cam_full, dtype=np.float32) / 255.0)

    overlay = Image.blend(
        Image.fromarray(np.asarray(img.convert("RGB"), dtype=np.uint8)),
        Image.fromarray((cam_rgb * 255).astype(np.uint8)),
        float(alpha),
    )
    # pure heatmap (grayscale x colormap, original dims, capped for transport)
    heat = Image.fromarray((_apply_colormap(np.asarray(cam_full, dtype=np.float32) / 255.0)
                            * 255).astype(np.uint8))

    return {
        "original_png_base64": _png_data_url(img, max_side=max_side),
        "gradcam_overlay_png_base64": _png_data_url(overlay, max_side=max_side),
        "gradcam_heatmap_png_base64": _png_data_url(heat, max_side=max_side),
    }


def _png_data_url(img: Image.Image, max_side: int | None = None) -> str:
    if max_side and max(img.size) > max_side:
        img = img.copy()
        img.thumbnail((max_side, max_side), Image.BILINEAR)
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def thumbnail_url(pil_img: Image.Image, side: int = 128) -> str:
    th = pil_img.copy()
    th.thumbnail((side, side))
    buf = io.BytesIO()
    th.save(buf, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
