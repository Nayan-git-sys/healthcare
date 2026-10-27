import type { ReactNode } from 'react'

/* ---------- small shared UI atoms used across MedVision AI pages ---------- */

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </section>
  )
}

export function StatCard({
  label,
  value,
  hint,
  accent = 'navy',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  accent?: 'navy' | 'teal'
}) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className={`text-2xl font-bold ${accent === 'teal' ? 'text-teal-adj-600' : 'text-navy-700'}`}>
        {value}
      </span>
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </Card>
  )
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin text-navy-600 ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
  )
}

export function EmptyState({
  icon = '🗂️',
  title,
  message,
  action,
}: {
  icon?: ReactNode
  title: string
  message: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center">
      <span className="text-3xl">{icon}</span>
      <h3 className="text-sm font-semibold text-navy-700">{title}</h3>
      <p className="max-w-md text-[13px] leading-relaxed text-slate-500">{message}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function ErrorBox({ title = 'Something went wrong', message }: { title?: string; message: ReactNode }) {
  return (
    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
      <p className="font-semibold">{title}</p>
      <p className="mt-0.5 leading-relaxed">{message}</p>
    </div>
  )
}

export function InfoNote({ children, tone = 'amber' }: { children: ReactNode; tone?: 'amber' | 'teal' | 'navy' }) {
  const tones = {
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    teal: 'border-teal-adj-500/30 bg-teal-adj-50 text-teal-adj-600',
    navy: 'border-navy-200 bg-navy-50 text-navy-700',
  } as const
  return (
    <div className={`rounded-xl border px-4 py-3 text-[13px] leading-relaxed ${tones[tone]}`}>
      {children}
    </div>
  )
}

/** Persistent medical-safety disclaimer (shown on every relevant page). */
export function DisclaimerBanner({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  if (variant === 'compact') {
    return (
      <p className="text-[11px] leading-relaxed text-slate-500">
        ⚠️ Research prototype — not a diagnostic tool. All outputs require
        interpretation by a qualified radiologist.
      </p>
    )
  }
  return (
    <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
      <span className="text-lg leading-none">⚠️</span>
      <p className="text-[13px] font-medium leading-relaxed text-amber-800">
        <strong>Medical disclaimer:</strong> MedVision AI is an educational and
        research prototype. Its predictions are experimental model outputs, not
        diagnoses, and they never confirm or exclude disease. Interpretation of
        chest X-rays and any clinical decision must be performed solely by a
        qualified radiologist or physician.
      </p>
    </div>
  )
}

const PCT = (v: number) => `${(v * 100).toFixed(1)}%`
export const fmtPct = PCT
