import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'

const NAV_ITEMS: { to: string; label: string; icon: ReactNode }[] = [
  {
    to: '/',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: '/analyze',
    label: 'Analyze X-ray',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: '/performance',
    label: 'Model Performance',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/about',
    label: 'About',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 16v-5M12 8h.01" strokeLinecap="round" />
      </svg>
    ),
  },
]

export function MedVisionLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-navy-600 to-teal-adj-600 text-white shadow-sm">
        {/* stylized chest-xray scan mark */}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
          <path d="M6 8l6 3 6-3M12 11v9M4 4h16" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-base font-bold tracking-tight text-navy-700">MedVision <span className="text-teal-adj-600">AI</span></span>
          <span className="block text-[11px] font-medium text-slate-500">Chest X-ray analysis · research prototype</span>
        </span>
      )}
    </div>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-slate-50">
      {/* mobile top bar: brand + horizontal nav */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur md:hidden">
        <div className="px-4 py-3">
          <MedVisionLogo />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2.5">
          {NAV_ITEMS.map((item) => (
            <MobileNavItem key={item.to} to={item.to} label={item.label} />
          ))}
        </nav>
      </header>

      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-6 md:px-6">
        {/* desktop sidebar */}
        <aside className="sticky top-6 hidden h-fit w-60 shrink-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex">
          <MedVisionLogo />
          <p className="mt-1.5 mb-5 text-[13px] text-slate-500">
            Explainable pneumonia screening · Grad-CAM
          </p>
          <nav className="flex flex-col gap-1.5">
            {NAV_ITEMS.map((item) => (
              <SidebarLink key={item.to} item={item} />
            ))}
          </nav>
          <div className="mt-auto pt-6">
            <div className="rounded-xl bg-teal-adj-50 px-3 py-2.5 text-[11px] leading-relaxed text-teal-adj-600">
              Educational prototype. Results are experimental and never a
              substitute for a qualified radiologist.
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}

function MobileNavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
          isActive ? 'bg-navy-600 text-white' : 'bg-slate-100 text-slate-600'
        }`
      }
    >
      {label}
    </NavLink>
  )
}

function SidebarLink({ item }: { item: { to: string; label: string; icon: ReactNode } }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-navy-600 text-white shadow-sm'
            : 'text-slate-600 hover:bg-navy-50 hover:text-navy-700'
        }`
      }
    >
      {item.icon}
      {item.label}
    </NavLink>
  )
}
