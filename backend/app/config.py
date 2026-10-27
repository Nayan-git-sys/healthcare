"""Central configuration and security limits for the MedVision AI backend."""
import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BACKEND_DIR / "models"
DATA_DIR = BACKEND_DIR / "data"

MODEL_PATH = MODELS_DIR / "best_model.pth"
METRICS_PATH = MODELS_DIR / "metrics.json"
DEFAULT_CHECKPOINT_DOC = (
    "backend/training/train.py  --  python -m training.train "
    "--arch cnn_baseline --size 128"
)

# --- upload limits -----------------------------------------------------------
MAX_UPLOAD_BYTES = 10 * 1024 * 1024          # 10 MiB
ALLOWED_CONTENT_TYPES = ("image/png", "image/jpeg", "image/jpg")
MIN_IMAGE_SIDE = 32
MAX_IMAGE_SIDE = 8000

# --- rendering ---------------------------------------------------------------
MAX_OVERLAY_PX = 768       # cap longest side of returned overlay images
DEFAULT_ALPHA = 0.40       # Grad-CAM overlay opacity

# --- CORS -------------------------------------------------------------------
def allowed_origins() -> list[str]:
    raw = os.environ.get(
        "MEDVISION_ALLOWED_ORIGINS",
        "http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173",
    )
    return [o.strip() for o in raw.split(",") if o.strip()]


# --- history ---------------------------------------------------------------
MAX_HISTORY_PER_SESSION = 100
