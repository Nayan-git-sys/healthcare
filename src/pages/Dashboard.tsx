import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getHealth,
  getHistory,
  getMetrics,
  type HealthResponse,
  type HistoryEntry,
  type MetricsPayload,
} from '../api'
import { ApiError } from '../api'
import { getSessionId } from '../lib/session'
import {
  Card,
  DisclaimerBanner,
  EmptyState,
  ErrorBox,
  InfoNote,
  StatCard,
  fmtPct,
} from '../components/ui'

export default function Dashboard() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [metrics, setMetrics] = useState<MetricsPayload | null>(null)
  const [metricsUnavailable, setMetricsUnavailable] = useState<string | null>(null)
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [backendError, setBackendError] = useState<string | null>(null)
  const sessionId = getSessionId()

  useEffect(() => {
    document.title = 'MedVision AI · Dashboard'
    getHealth()
      .then(setHealth)
      .catch((e: unknown) => setBackendError(describe(e)))
    getMetrics()
      .then(setMetrics)
      .catch((e: unknown) => setMetricsUnavailable(describe(e)))
    getHistory(sessionId, 50)
      .then((h) => {
        setEntries(h.entries)
        setTotal(h.analyses_total)
      })
      .catch(() => {
        /* history is purely a convenience view; dashboard still renders */
        setTotal(null)
      })
  }, [sessionId])

  const modelReady = health?.model_configured === true

  return (
    <div className="flex flex-col gap-6">
      {/* hero */}
      <Card className="bg-gradient-to-br from-navy-700 via-navy-600 to-teal-adj-600/80 text-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              Explainable chest X-ray analysis
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-navy-100">
              Upload a chest X-ray and a trained PyTorch CNN predicts
              <strong> Normal</strong> vs <strong>Pneumonia</strong> with a
              Grad-CAM heatmap showing where the model attends. A research
              prototype — never a diagnosis.
            </p>
          </div>
          <Link
            to="/analyze"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-navy-700 shadow-md transition hover:bg-navy-50 active:scale-[0.98]"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Analyze New X-ray
          </Link>
        </div>
      </Card>

      {backendError && <ErrorBox title="Backend unreachable" message={backendError} />}

      {/* stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Analyses this session"
          value={total ?? '—'}
          hint={total === null ? 'Backend unavailable' : 'Stored per browser session'}
        />
        <StatCard
          label="Model"
          value={modelReady ? `${health!.info!.arch} ${health!.info!.version}` : 'Not configured'}
          hint={modelReady ? health!.info!.trained_at ?? 'trained model loaded' : 'train a checkpoint first'}
          accent="teal"
        />
        <StatCard
          label="Dataset"
          value={modelReady ? health!.info!.dataset.replace(/ \(.*\)$/, '') : '—'}
          hint="MedMNIST v2 · CC BY-NC-SA 4.0"
        />
        <StatCard
          label="Classes"
          value="Normal · Pneumonia"
          hint="binary classification"
        />
      </div>

      <InfoNote tone={modelReady ? 'teal' : 'amber'}>
        {modelReady ? (
          <>
            <strong>Model ready:</strong> {health!.info!.name} is loaded on the
            server ({health!.info!.image_size}×{health!.info!.image_size}
            ×1 input, normalize μ={health!.info!.normalize.mean.join(', ')} σ=
            {health!.info!.normalize.std.join(', ')}). Inference and Grad-CAM
            run for real through the FastAPI backend.
          </>
        ) : (
          <>
            <strong>AI model not configured.</strong>{' '}
            {health?.detail ??
              'The trained checkpoint (backend/models/best_model.pth) was not found, so predictions are disabled.'}{' '}
            See the backend README to train one.
          </>
        )}
      </InfoNote>

      {/* evaluation section */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Genuine model evaluation <span className="text-slate-400">(hold-out test set)</span>
          </h2>
        </div>
        {metrics ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricTile label="Accuracy" value={fmtPct(metrics.test.accuracy)} />
            <MetricTile label="AUROC" value={metrics.test.auroc.toFixed(3)} />
            <MetricTile label="Sensitivity (Pneumonia)" value={fmtPct(metrics.test.sensitivity)} />
            <MetricTile label="Specificity (Normal)" value={fmtPct(metrics.test.specificity)} />
            <p className="col-span-full text-[11px] leading-relaxed text-slate-500">
              Evaluated on {metrics.test.n_samples} held-out test images from{' '}
              {metrics.model.dataset}, produced by <code>backend/training/train.py</code> — not
              estimated, copied or inflated. Full detail on the{' '}
              <Link className="font-medium text-navy-600 underline" to="/performance">Model Performance</Link>{' '}
              page.
            </p>
          </div>
        ) : (
          <EmptyState
            icon="📊"
            title="Not evaluated yet"
            message={
              metricsUnavailable
                ? `No genuine evaluation metrics are available${metricsUnavailable === NOT_EVALUATED ? '' : `: ${metricsUnavailable}`}. Run the training script to produce a real test-set report.`
                : 'Loading…'
            }
          />
        )}
      </Card>

      {/* recent analyses */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Recent analyses <span className="text-slate-400">(this browser session)</span>
          </h2>
        </div>
        {entries.length > 0 && total !== null ? (
          <ul className="divide-y divide-slate-100">
            {entries.slice(0, 5).map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2.5">
                {e.thumbnail_png_base64 ? (
                  <img
                    src={e.thumbnail_png_base64}
                    alt="X-ray thumbnail"
                    className="h-10 w-10 rounded-lg object-cover ring-1 ring-slate-200"
                  />
                ) : (
                  <span className="h-10 w-10 rounded-lg bg-slate-100" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-slate-700">{e.filename}</p>
                  <p className="text-[11px] text-slate-500">{e.created_at}</p>
                </div>
                <span
                  className={`ml-auto rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    e.predicted_class === 'Pneumonia'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {e.predicted_class}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon="🖼️"
            title={total === null ? 'History unavailable' : 'No analyses in this session yet'}
            message={
              total === null
                ? 'Could not reach the backend history store. Start the FastAPI server, then analyze an image to populate this list.'
                : 'Analyzing an X-ray stores an in-memory, session-only record here. Records are not persisted and never used as patient data.'
            }
          />
        )}
      </Card>

      <DisclaimerBanner />
    </div>
  )
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3 text-center ring-1 ring-slate-200">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-navy-700">{value}</p>
    </div>
  )
}

export const NOT_EVALUATED = 'Not evaluated yet'

function describe(e: unknown): string {
  if (e instanceof ApiError) return e.detail
  if (e instanceof TypeError)
    return 'Could not reach the FastAPI backend. Start it with: py -3.13 -m uvicorn app.main:app (from backend/).'
  return String(e)
}
