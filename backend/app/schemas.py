"""Pydantic response models for the MedVision AI REST API."""
from pydantic import BaseModel, Field


class ClassScore(BaseModel):
    label: str
    score: float

    model_config = {"protected_namespaces": ()}


class ModelInfo(BaseModel):
    name: str
    version: str
    arch: str
    classes: list[str]
    image_size: int
    dataset: str
    normalize: dict
    trained_at: str | None = None


class HealthResponse(BaseModel):
    status: str
    model_configured: bool
    detail: str
    info: ModelInfo | None = None


class AnalyzeResponse(BaseModel):
    analysis_id: str
    predicted_class: str
    predicted_class_idx: int
    scores: list[ClassScore]
    gradcam_overlay_png_base64: str
    heatmap_png_base64: str
    original_png_base64: str
    gradcam_target_layer: str
    model_version: str
    arch: str
    inference_ms: int
    gradcam_ms: int
    created_at: str
    uploaded_filename: str
    image_dims: list[int]
    warnings: list[str] = Field(default_factory=list)


class HistoryEntry(BaseModel):
    id: str
    created_at: str
    filename: str
    predicted_class: str
    predicted_class_idx: int
    scores: list[ClassScore]
    model_version: str
    thumbnail_png_base64: str | None = None
