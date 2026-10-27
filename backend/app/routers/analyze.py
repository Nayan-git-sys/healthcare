"""Analyze endpoint + session history endpoints."""
import uuid

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from PIL import Image

from ..schemas import AnalyzeResponse, ClassScore
from ..services import history
from ..services import inference as inf
from ..services.model_runtime import ModelNotConfigured

router = APIRouter(prefix="/api", tags=["analyze"])

_SCORES_NOT_PROBABILITY = (
    "Model scores are raw class likelihoods (softmax outputs), not calibrated "
    "clinical probabilities. They require professional interpretation."
)


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    file: UploadFile | None = File(default=None, description="PNG/JPEG chest X-ray image"),
    alpha: float = Form(default=0.4, ge=0.0, le=1.0, description="heatmap overlay opacity"),
    session_id: str = Form(default=""),
):
    if file is None or (file.filename in (None, "") ):
        raise HTTPException(status_code=422, detail="No image file was sent.")
    raw = await file.read()
    try:
        inf.validate_upload(raw, file.filename or "")
        img = inf.decode_image(raw)
        result = inf.run_inference(img)
    except inf.InvalidImageError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ModelNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except (inf.InferenceFailure, RuntimeError) as e:
        raise HTTPException(status_code=500, detail=str(e))

    rendered = inf.render_outputs(img, result["cam"], alpha=float(alpha))

    thumbnail = None
    if session_id:
        thumbnail = inf.thumbnail_url(img, 160)
        history.add_entry(session_id, {
            "filename": file.filename,
            "predicted_class": result["predicted_class"],
            "predicted_class_idx": result["predicted_class_idx"],
            "scores": result["scores"],
            "model_version": result["model"]["version"],
            "thumbnail_png_base64": thumbnail,
        })

    return AnalyzeResponse(
        analysis_id=uuid.uuid4().hex[:12],
        uploaded_filename=file.filename or "",
        image_dims=list(img.size),
        created_at=history._now(),
        gradcam_target_layer=result["gradcam_target_layer"],
        inference_ms=result["inference_ms"],
        gradcam_ms=result["gradcam_ms"],
        model_version=result["model"]["version"],
        arch=result["model"]["arch"],
        original_png_base64=rendered["original_png_base64"],
        gradcam_overlay_png_base64=rendered["gradcam_overlay_png_base64"],
        heatmap_png_base64=rendered["gradcam_heatmap_png_base64"],
        predicted_class=result["predicted_class"],
        predicted_class_idx=result["predicted_class_idx"],
        scores=result["scores"],
        warnings=[_SCORES_NOT_PROBABILITY],
    )


@router.get("/history")
def get_history(session_id: str = Query(...), limit: int = Query(20, ge=1, le=100)):
    return {
        "session_id": session_id,
        "analyses_total": history.session_analyses_count(session_id),
        "entries": history.history_for(session_id)[:limit],
    }


@router.delete("/history")
def delete_history(session_id: str = Query(...)):
    n = history.clear(session_id)
    return {"session_id": session_id, "cleared": n}
