"""MedVision AI FastAPI application (real PyTorch inference + Grad-CAM)."""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import allowed_origins
from .routers import analyze, info
from .services.model_runtime import ModelNotConfigured, runtime


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        runtime.load()
        print("[startup] model ready - real predictions enabled.")
    except ModelNotConfigured as e:
        print("[startup] " + str(e).replace("\n", " | "))
        print("[startup] API will run in 'AI model not configured' mode; "
              "predict endpoints return 503 until a checkpoint exists.")
    yield


app = FastAPI(
    title="MedVision AI API",
    description=(
        "Educational chest X-ray classification API (Normal/Pneumonia) with "
        "Grad-CAM explainability. Research prototype - NOT a medical "
        "diagnostic tool; never replace professional radiology review."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(info.router)
app.include_router(analyze.router)


@app.get("/")
def root():
    return {"name": "MedVision AI API", "health": "/api/health",
            "docs": "/docs"}
