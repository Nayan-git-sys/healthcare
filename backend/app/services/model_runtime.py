"""Model runtime: safe checkpoint loading (never substitutes random weights).

If models/best_model.pth does not exist the backend reports itself as
"AI model not configured" (HTTP 503) instead of predicting anything.
"""
import torch
import torch.nn as nn

from training.models import ARCHS
from .. import config


class ModelNotConfigured(Exception):
    """Raised when no trained checkpoint is available on disk."""


class ModelRuntime:
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model: nn.Module | None = None
        self.meta: dict | None = None

    def load(self):
        if not config.MODEL_PATH.is_file():
            raise ModelNotConfigured(
                "AI model not configured: no trained checkpoint found at "
                f"{config.MODEL_PATH}. Train one with:\n"
                f"    py -3.13 -m training.train --arch cnn_baseline --size 128\n"
                f"(run from backend/, see backend/README.md)"
            )
        ckpt = torch.load(config.MODEL_PATH, map_location=self.device, weights_only=True)
        meta = ckpt.get("meta") or {}
        arch = meta.get("arch")
        if arch not in ARCHS:
            raise ModelNotConfigured(f"Checkpoint has unsupported arch: {arch!r}")
        from training.models import build_model

        model = build_model(arch, in_channels=int(meta.get("in_channels", 1)),
                            num_classes=len(meta.get("classes") or ["Normal", "Pneumonia"]))
        model.load_state_dict(ckpt["state_dict"])
        model.to(self.device)
        model.eval()
        self.model = model
        self.meta = {
            "name": "MedVision AI Chest X-ray Classifier",
            "version": meta.get("version", "v1.0.0"),
            "arch": arch,
            "classes": list(meta.get("classes") or ["Normal", "Pneumonia"]),
            "image_size": int(meta.get("image_size", 128)),
            "dataset": meta.get("dataset", "PneumoniaMNIST (MedMNIST v2)"),
            "normalize": meta.get("normalize", {"mean": [0.4761], "std": [0.2575]}),
            "trained_at": meta.get("trained_at"),
        }
        print(f"[model] loaded {arch} v{self.meta['version']} on {self.device}")

    def describe(self) -> dict:
        if self.model is None:
            raise ModelNotConfigured("Model not loaded.")
        return self.meta


runtime = ModelRuntime()
