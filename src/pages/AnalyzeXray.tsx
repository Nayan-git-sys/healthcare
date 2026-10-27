import { useCallback, useEffect, useRef, useState, forwardRef } from 'react'
import {
  analyze as apiAnalyze,
  type AnalyzeResponse,
} from '../api'
import { ApiError } from '../api'
import { getSessionId } from '../lib/session'
import {
  Card,
  DisclaimerBanner,
  ErrorBox,
  Spinner,
} from '../components/ui'
import { ScoreBarChart } from '../components/ScoreBarChart'

const ACCEPTED = ['image/png', 'image/jpeg']
const MAX_BYTES = 10 * 1024 * 1024
const SESSION_KEY = getSessionId()

type Phase = 'idle' | 'uploading' | 'inferencing' | 'done'

export default function AnalyzeXray() {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalyzeResponse | null>(null)
  const [overlayOpacity, setOverlayOpacity] = useState(0.45)
  const fileInput = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.title = 'MedVision AI · Analyze X-ray'
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const validateAndAccept = useCallback(
    (f: File): string | null => {
      if (!ACCEPTED.includes(f.type))
        return `“${f.name}” is not a PNG or JPEG image${f.type ? '' : ' (unknown type)'}. MedVision AI accepts chest X-rays stored as .png or .jpg/.jpeg files only.`
      if (f.size > MAX_BYTES)
        return `“${f.name}” is ${(f.size / 1e6).toFixed(1)} MB. The limit is 10 MB — please export a smaller image.`
      if (f.size === 0) return `“${f.name}” is empty. Choose a valid image file.`
      return null
    },
    [],
  )

  const acceptFile = useCallback(
    (f: File) => {
      const problem = validateAndAccept(f)
      if (problem) {
        setError(problem)
        return
      }
      setError(null)
      setResult(null)
      setPhase('idle')
      setFile(f)
      setPreviewUrl(URL.createObjectURL(f))
    },
    [validateAndAccept],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragActive(false)
      const f = e.dataTransfer.files?.[0]
      if (f) acceptFile(f)
    },
    [acceptFile],
  )

  const runAnalysis = useCallback(async () => {
    if (!file) return
    setPhase('uploading')
    setProgress(0)
    setError(null)
    setResult(null)
    try {
      setPhase('inferencing')
      const res = await apiAnalyze(file, {
        alpha: 0.4,
        sessionId: SESSION_KEY,
        onProgress: setProgress,
      })
      setResult(res)
      setPhase('done')
      requestAnimationFrame(() =>
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      )
    } catch (e: unknown) {
      setPhase('idle')
      setError(describe(e))
    }
  }, [file])

  const resetAll = useCallback(() => {
    setFile(null)
    setPreviewUrl(null)
    setResult(null)
    setError(null)
    setPhase('idle')
    setOverlayOpacity(0.45)
  }, [])

  const busy = phase === 'uploading' || phase === 'inferencing'

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-navy-700">Analyze chest X-ray</h1>
        <p className="mt-1 text-[13px] text-slate-500">
          Upload a grayscale chest X-ray (PNG or JPEG, ≤ 10 MB). The image is
          sent to the FastAPI backend where the trained PyTorch model performs a
          real inference and generates a Grad-CAM heatmap. The model was trained
          on frontal chest X-rays (PneumoniaMNIST); arbitrary non-radiograph
          images will produce meaningless results.
        </p>
      </div>

      {/* upload zone */}
      {!file && (
        <Card>
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload a chest X-ray image"
            onDragOver={(e) => {
              e.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            onClick={() => fileInput.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && fileInput.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition ${
              dragActive
                ? 'border-teal-adj-500 bg-teal-adj-50'
                : 'border-slate-300 bg-slate-50/70 hover:border-navy-400 hover:bg-navy-50'
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              className="h-10 w-10 text-navy-500"
            >
              <path d="M12 16V4m0 0L8 8m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 16.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2.5" strokeLinecap="round" />
            </svg>
            <p className="text-sm font-semibold text-navy-700">
              Drag &amp; drop a chest X-ray here
            </p>
            <p className="text-[13px] text-slate-500">PNG or JPEG · max 10 MB · single image</p>
            <span className="rounded-xl bg-navy-600 px-4 py-2 text-sm font-medium text-white shadow-sm">
              Browse files
            </span>
            <input
              ref={fileInput}
              type="file"
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) acceptFile(f)
                e.currentTarget.value = ''
              }}
            />
          </div>
          <p className="mt-4 text-[12px] leading-relaxed text-slate-500">
            The model only understands frontal pediatric chest radiographs
            resembling its training data (PneumoniaMNIST was built from the
            NIH CSP and Guangzhou collections, children aged 1–5).
            Photos of documents, skin lesions, MRI/CT scans or unrelated images
            will not produce valid output —
            unrelated images will not produce valid output — the service simply
            classifies the pixels it receives, so only submit genuine chest
            X-rays. This application does not handle any personal or patient
            identifiable information.
          </p>
        </Card>
      )}

      {/* preview + action */}
      {file && previewUrl && (
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <img
              src={previewUrl}
              alt={`Preview of uploaded ${file.name}`}
              className="h-56 w-full rounded-xl bg-slate-100 object-contain ring-1 ring-slate-200 sm:w-64"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div>
                <p className="truncate text-sm font-semibold text-navy-700">{file.name}</p>
                <p className="text-[12px] text-slate-500">
                  {(file.size / 1024).toFixed(0)} KB · {file.type}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={runAnalysis}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl bg-navy-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-700 disabled:opacity-50"
                >
                  {busy ? <Spinner className="h-4 w-4" /> : null}
                  {busy ? 'Analyzing…' : 'Analyze X-ray'}
                </button>
                <button
                  onClick={resetAll}
                  disabled={busy}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Remove image
                </button>
              </div>
              {busy && phase === 'inferencing' && (
                <p className="text-[12px] text-slate-500">
                  Forward pass + Grad-CAM on the server… network upload{' '}
                  {progress > 0 && progress < 100 ? `${progress}%` : 'complete'}, inference in progress.
                </p>
              )}
              <p className="text-[12px] leading-relaxed text-slate-500">
                By analyzing you agree this is an experimental prototype and the
                output will never be treated as a medical diagnosis.
              </p>
            </div>
          </div>
          {busy && (
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full bg-teal-adj-500 transition-all ${phase === 'inferencing' ? 'w-2/3 animate-pulse' : 'w-1/3'}`}
              />
            </div>
          )}
        </Card>
      )}

      {error && <ErrorBox title="Analysis failed" message={error} />}

      {result && <ResultPanel result={result} overlayOpacity={overlayOpacity}
        onOpacityChange={setOverlayOpacity} onNewImage={resetAll} ref={resultsRef} />}

      <DisclaimerBanner />
    </div>
  )
}

/* ----------------------------- results ----------------------------- */

function describe(e: unknown): string {
  if (e instanceof ApiError) return e.detail
  if (e instanceof TypeError)
    return 'Cannot reach the MedVision AI backend. Start it with: py -3.13 -m uvicorn app.main:app (from backend/).'
  return String(e)
}

const ResultPanel = forwardRef<
  HTMLDivElement,
  {
    result: AnalyzeResponse
    overlayOpacity: number
    onOpacityChange: (v: number) => void
    onNewImage: () => void
  }
>(function ResultPanel({ result, overlayOpacity, onOpacityChange, onNewImage }, ref) {
  const predScore =
    result.scores.find((s) => s.label === result.predicted_class)?.score ?? 0
  return (
    <div ref={ref} className="flex flex-col gap-6">
      {/* prediction header */}
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Model prediction
            </p>
            <p className="mt-1 text-2xl font-bold text-navy-700">
              {result.predicted_class}
              <span className="ml-2 align-middle text-[11px] font-medium text-slate-500">
                (model score {((predScore * 100)).toFixed(1)}%)
              </span>
            </p>
            <p className="mt-1 text-[12px] text-slate-500">
              {result.arch} {result.model_version} · inference {result.inference_ms} ms ·
              Grad-CAM {result.gradcam_ms} ms · {result.gradcam_target_layer}
            </p>
          </div>
          <button
            onClick={onNewImage}
            className="self-start rounded-xl bg-teal-adj-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-adj-600/90"
          >
            Analyze another image
          </button>
        </div>
        {/* class score bars via Recharts */}
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-navy-700">Class scores</h3>
            <ScoreBarChart scores={result.scores} predicted={result.predicted_class} />
          </div>
          <div className="flex flex-col justify-center gap-2 text-[12px] leading-relaxed text-slate-600">
            <h3 className="mb-1 text-sm font-semibold text-navy-700">How to read these scores</h3>
            <p>
              Each bar is the raw softmax output the model assigns to one of its
              two classes on <em>this</em> image. The higher bar is the predicted
              class.
            </p>
            {result.warnings.map((w) => (
              <p key={w} className="font-medium text-amber-700">
                ⚠ {w}
              </p>
            ))}
            <DisclaimerBanner variant="compact" />
          </div>
        </div>
      </Card>

      {/* images */}
      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Grad-CAM explanation
        </h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          {/* original */}
          <figure className="flex flex-col items-center gap-2">
            <img
              src={result.original_png_base64}
              alt="Uploaded chest X-ray"
              className="max-h-80 w-full rounded-xl bg-slate-900/95 object-contain ring-1 ring-slate-200"
            />
            <figcaption className="text-[11px] font-medium text-slate-500">
              Uploaded X-ray ({result.uploaded_filename}, {result.image_dims[0]}×{result.image_dims[1]})
            </figcaption>
          </figure>

          {/* overlay with opacity slider */}
          <div className="lg:col-span-2">
            <div className="rounded-xl bg-slate-900/95 p-3 ring-1 ring-slate-200">
              <div className="relative mx-auto w-fit">
                <img
                  src={result.original_png_base64}
                  alt="Original X-ray used for the heatmap overlay"
                  className="max-h-80 object-contain"
                />
                <img
                  src={result.heatmap_png_base64}
                  alt="Grad-CAM heatmap resized to the X-ray dimensions"
                  className="absolute inset-0 max-h-full object-contain"
                  style={{ opacity: overlayOpacity }}
                />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <label htmlFor="camOpacity" className="text-[12px] font-medium text-slate-600">
                Heatmap opacity
              </label>
              <input
                id="camOpacity"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={overlayOpacity}
                onChange={(e) => onOpacityChange(Number(e.target.value))}
                className="h-1.5 w-56 accent-teal-adj-500"
              />
              <span className="text-[12px] tabular-nums text-slate-500">
                {Math.round(overlayOpacity * 100)}%
              </span>
              <span className="ml-auto hidden gap-2 sm:flex">
                <span className="h-3 w-6 rounded-sm bg-gradient-to-r from-[#0f206e] via-[#02bfbf] to-[#eb3939]" />
                <span className="text-[11px] text-slate-500">less ← Grad-CAM attention → more</span>
              </span>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <figure className="flex flex-col items-center gap-2">
                <img
                  src={result.heatmap_png_base64}
                  alt="Standalone Grad-CAM heatmap"
                  className="max-h-60 rounded-xl object-contain ring-1 ring-slate-200"
                />
                <figcaption className="text-[11px] text-slate-500">
                  Standalone heatmap (no overlay)
                </figcaption>
              </figure>
              <div className="text-[12px] leading-relaxed text-slate-600">
                <h3 className="mb-1 text-sm font-semibold text-navy-700">
                  Interpreting the heatmap
                </h3>
                <p className="mb-1">
                  Grad-CAM (Selvaraju et al., 2017) is computed by backpropagating
                  the predicted class score to the last convolutional layer
                  (<code className="text-navy-700">{result.gradcam_target_layer}</code>)
                  of {result.arch}. The grid map is rescaled to the original image
                  dimensions and colored by a jet-like palette.
                </p>
                <p>
                  <strong>Warm colours (red/yellow)</strong> mark regions the
                  model weighted most heavily for its prediction.
                  <strong> Cool colours </strong>
                  were largely ignored. This is an attention
                  visualization only: a plausible or implausible-looking heatmap
                  neither proves nor disproves the prediction, and it is not a
                  localization of disease.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
})
