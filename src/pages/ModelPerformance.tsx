import { useEffect, useState } from 'react'
import { getMetrics, ApiError } from '../api'
import type { MetricsPayload } from '../api'
import {
  Card,
  DisclaimerBanner,
  EmptyState,
  ErrorBox,
  InfoNote,
  Spinner,
  StatCard,
  fmtPct,
} from '../components/ui'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export default function ModelPerformance() {
  const [metrics, setMetrics] = useState<MetricsPayload | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'none' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'MedVision AI · Model Performance'
    getMetrics()
      .then((m) => {
        setMetrics(m)
        setStatus('ready')
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 404) setStatus('none')
        else {
          setStatus('error')
          setError(describe(e))
        }
      })
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-navy-700">Model performance</h1>
        <p className="mt-1 text-[13px] text-slate-500">
          Every number below comes straight from <code>models/metrics.json</code>, produced by the
          training script on the held-out test split. Nothing on this page is
          estimated, simulated or copied from another paper.
        </p>
      </div>

      {status === 'loading' && (
        <Card>
          <div className="flex items-center gap-3 py-8 text-slate-500">
            <Spinner /> Loading genuine evaluation results…
          </div>
        </Card>
      )}

      {status === 'error' && <ErrorBox title="Metrics unavailable" message={error ?? ''} />}

      {status === 'none' && (
        <Card>
          <EmptyState
            icon="🔍"
            title="Not evaluated yet"
            message={
              <>
                The backend has no <code>metrics.json</code>, so there are no
                genuine results to show. Train the model to generate a real
                test-set report:
                <br />
                <code className="mt-2 inline-block rounded bg-slate-100 px-2 py-1 text-[12px]">
                  py -3.13 -m training.train --arch cnn_baseline --size 128
                </code>
                <span className="mt-2 block">
                  MedVision AI never displays invented performance statistics.
                </span>
              </>
            }
          />
        </Card>
      )}

      {status === 'ready' && metrics && <MetricsReport metrics={metrics} />}

      <DisclaimerBanner />
    </div>
  )
}

function MetricsReport({ metrics }: { metrics: MetricsPayload }) {
  const t = metrics.test
  const confusion = [
    { name: 'Predicted Normal', tn: t.tn, fp: t.fp },
    { name: 'Predicted Pneumonia', fn: t.fn, tp: t.tp },
  ]
  const valCurve = metrics.history.filter((h) => h.split === 'val')

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Test accuracy" value={fmtPct(t.accuracy)} hint={`${t.n_samples} test images`} />
        <StatCard label="AUROC" value={t.auroc.toFixed(3)} hint="Pneumonia class" accent="teal" />
        <StatCard label="Balanced accuracy" value={fmtPct(t.balanced_accuracy)} hint={`best val ${fmtPct(metrics.best_val_balanced_accuracy)}`} />
        <StatCard label="Macro F1" value={t.f1_macro.toFixed(3)} hint={`decision threshold ${metrics.threshold}`} />
      </div>

      <InfoNote tone="navy">
        <strong>Dataset:</strong> {metrics.model.dataset}.{' '}
        <strong>Class distribution of the test set:</strong>{' '}
        Normal {t.class_counts.Normal}, Pneumonia {t.class_counts.Pneumonia}.
        Metrics depend on this distribution and do not transfer to other
        scanners, populations or hospitals.
      </InfoNote>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ROC */}
        <Card>
          <h2 className="text-sm font-semibold text-navy-700">ROC curve (test set)</h2>
          <p className="mb-2 text-[12px] text-slate-500">True-positive rate vs false-positive rate across thresholds.</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.roc_curve} margin={{ left: -8, right: 12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="fpr" domain={[0, 1]} tick={{ fontSize: 11, fill: '#64748b' }} label={{ value: 'False-positive rate', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#475569' }} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Line type="monotone" dataKey="tpr" stroke="#0f766e" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line data={[{ fpr: 0, tpr: 0 }, { fpr: 1, tpr: 1 }]} dataKey="tpr" stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1} dot={false} isAnimationActive={false} />
                <Tooltip
                  formatter={(v: unknown, name: unknown) => [Number(v).toFixed(3), name === 'tpr' ? 'TPR' : 'chance'] as [string, string]}
                  labelFormatter={(v: unknown) => `FPR ≈ ${Number(v).toFixed(3)}`}
                  contentStyle={{ fontSize: 12 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* confusion matrix */}
        <Card>
          <h2 className="text-sm font-semibold text-navy-700">Confusion matrix (threshold {metrics.threshold})</h2>
          <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-slate-200">
            <table className="w-full text-center text-[13px]">
              <thead>
                <tr className="bg-navy-50 text-[11px] uppercase tracking-wide text-navy-700">
                  <th className="px-3 py-2 text-left">Actual ↓</th>
                  <th className="px-3 py-2">Normal</th>
                  <th className="px-3 py-2">Pneumonia</th>
                </tr>
              </thead>
              <tbody>
                {confusion.map((row, i) => {
                  const cells = i === 0 ? [row.tn, row.fp] : [row.fn, row.tp]
                  const correct = i === 0 ? 0 : 1
                  return (
                    <tr key={row.name} className="border-t border-slate-100 bg-white">
                      <td className="px-3 py-2 text-left font-medium text-slate-600">
                        {i === 0 ? 'Normal' : 'Pneumonia'}
                      </td>
                      {cells.map((c, j) => (
                        <td
                          key={j}
                          className={`px-3 py-2 font-semibold ${
                            j === correct ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {c}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            Sensitivity (Pneumonia recall) <strong>{fmtPct(t.sensitivity)}</strong> · specificity
            (Normal recall) <strong>{fmtPct(t.specificity)}</strong> · precision <strong>{fmtPct(t.precision)}</strong>.
          </p>
        </Card>
      </div>

      {/* training history validation bal-acc */}
      {valCurve.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-navy-700">Validation balanced accuracy per epoch</h2>
          <p className="mb-2 text-[12px] text-slate-500">Genuine values logged during training on the validation split.</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={valCurve} margin={{ left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="epoch" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis domain={[0.5, 1]} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(v: unknown) => fmtPct(Number(v))}
                  labelFormatter={(e: unknown) => `Epoch ${String(e)}`}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="balanced_accuracy" fill="#1e3a5f" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </>
  )
}

function describe(e: unknown): string {
  if (e instanceof ApiError) return e.detail
  if (e instanceof TypeError)
    return 'Could not reach the backend. Start the FastAPI server and reload this page.'
  return String(e)
}
