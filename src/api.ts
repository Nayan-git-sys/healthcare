/**
 * Typed REST client for the MedVision AI FastAPI backend.
 * Base URL: VITE_API_URL (default http://localhost:8000).
 */

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  status: number
  detail: string
  constructor(status: number, detail: string) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

async function handle(res: Response): Promise<unknown> {
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    if (res.status === 404) {
      try {
        const body = (await res.json()) as { detail?: { message?: string } | string }
        detail =
          typeof body.detail === 'object' && body.detail?.message
            ? body.detail.message
            : (body.detail as string) ?? detail
      } catch {
        /* keep default */
      }
    } else {
      try {
        const body = (await res.json()) as { detail?: string }
        detail = body.detail ?? detail
      } catch {
        /* keep default */
      }
    }
    throw new ApiError(res.status, detail)
  }
  return res.json()
}

/* ---------- types ---------- */

export interface ClassScore {
  label: string
  score: number
}

export interface ModelInfo {
  name: string
  version: string
  arch: string
  classes: string[]
  image_size: number
  dataset: string
  normalize: { mean: number[]; std: number[] }
  trained_at?: string
}

export interface HealthResponse {
  status: string
  model_configured: boolean
  detail: string
  info?: ModelInfo
}

export interface TestMetrics {
  threshold: number
  n_samples: number
  class_counts: Record<string, number>
  accuracy: number
  balanced_accuracy: number
  auroc: number
  tp: number
  tn: number
  fp: number
  fn: number
  sensitivity: number
  specificity: number
  precision: number
  f1_macro: number
}

export interface MetricsPayload {
  model: {
    name: string
    version: string
    arch: string
    dataset: string
    trained_at: string
    classes: string[]
    image_size: number
  }
  test: TestMetrics
  best_val_balanced_accuracy: number
  roc_curve: { threshold: number; fpr: number; tpr: number }[]
  history: { epoch: number; split: string; loss: number; balanced_accuracy: number; accuracy: number }[]
  threshold: number
  disclaimer: string
}

export interface AnalyzeResponse {
  analysis_id: string
  predicted_class: string
  predicted_class_idx: number
  scores: ClassScore[]
  gradcam_overlay_png_base64: string
  heatmap_png_base64: string
  original_png_base64: string
  gradcam_target_layer: string
  model_version: string
  arch: string
  inference_ms: number
  gradcam_ms: number
  created_at: string
  uploaded_filename: string
  image_dims: number[]
  warnings: string[]
}

export interface HistoryEntry {
  id: string
  created_at: string
  filename: string
  predicted_class: string
  predicted_class_idx: number
  scores: ClassScore[]
  model_version: string
  thumbnail_png_base64?: string | null
}

export interface HistoryResponse {
  session_id: string
  analyses_total: number
  entries: HistoryEntry[]
}

/* ---------- API calls ---------- */

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/health`)
  return handle(res) as Promise<HealthResponse>
}

export async function getMetrics(): Promise<MetricsPayload> {
  const res = await fetch(`${API_BASE}/api/metrics`)
  return handle(res) as Promise<MetricsPayload>
}

export async function getHistory(sessionId: string, limit = 50): Promise<HistoryResponse> {
  const res = await fetch(
    `${API_BASE}/api/history?session_id=${encodeURIComponent(sessionId)}&limit=${limit}`,
  )
  return handle(res) as Promise<HistoryResponse>
}

export async function clearHistory(sessionId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/history?session_id=${encodeURIComponent(sessionId)}`,
    { method: 'DELETE' },
  )
  await handle(res)
}

export async function analyze(
  file: File,
  opts: { alpha?: number; sessionId?: string; onProgress?: (pct: number) => void } = {},
): Promise<AnalyzeResponse> {
  const form = new FormData()
  form.append('file', file)
  form.append('alpha', String(opts.alpha ?? 0.4))
  if (opts.sessionId) form.append('session_id', opts.sessionId)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}/api/analyze`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && opts.onProgress) {
        opts.onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300) resolve(body as AnalyzeResponse)
        else reject(new ApiError(xhr.status, body.detail ?? `${xhr.status} request failed`))
      } catch {
        reject(new ApiError(xhr.status, `${xhr.status} unexpected response`))
      }
    }
    xhr.onerror = () =>
      reject(
        new ApiError(
          0,
          `Cannot reach the MedVision AI backend at ${API_BASE}. Start it with: py -3.13 -m uvicorn app.main:app --reload (from backend/).`,
        ),
      )
    xhr.send(form)
  })
}
