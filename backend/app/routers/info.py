"""Info endpoints: health, model info, genuine evaluation metrics."""
import json

from fastapi import APIRouter, HTTPException

from ..schemas import HealthResponse, ModelInfo
from .. import config
from ..services.model_runtime import ModelNotConfigured, runtime

router = APIRouter(prefix="/api", tags=["info"])


@router.get("/health", response_model=HealthResponse)
def health():
    try:
        meta = runtime.describe()
        return HealthResponse(
            status="ok", model_configured=True,
            detail="Trained model loaded and ready for real inference.",
            info=ModelInfo(**meta))
    except ModelNotConfigured as e:
        return HealthResponse(
            status="degraded", model_configured=False,
            detail=str(e), info=None)


@router.get("/model-info", response_model=ModelInfo)
def model_info():
    try:
        return ModelInfo(**runtime.describe())
    except ModelNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/metrics")
def metrics():
    """Genuine test-set evaluation produced by backend/training/train.py.

    404 (with requires_evaluation message) when metrics.json is absent.
    """
    if not config.METRICS_PATH.is_file():
        raise HTTPException(
            status_code=404,
            detail={"message": "Not evaluated yet: no metrics.json found. Run "
                    "python -m training.train to produce genuine test metrics."})
    try:
        with open(config.METRICS_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        raise HTTPException(status_code=500,
                            detail="metrics.json is unreadable: " + str(e))
