import { ChevronRight } from 'lucide-react'

export function Card({ children, className = '' }) {
  return (
    <section
      className={`rounded-[1.5rem] bg-white p-5 shadow-card ${className}`}
    >
      {children}
    </section>
  )
}

export function PrimaryButton({ children, className = '', ...props }) {
  return (
    <button
      className={`flex w-full items-center justify-center rounded-2xl bg-soma-800 px-5 py-4 font-semibold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function ProgressBar({
  value,
  className = '',
  barClassName = 'bg-soma-500',
}) {
  return (
    <div
      className={`h-2.5 overflow-hidden rounded-full bg-soma-100 ${className}`}
    >
      <div
        className={`h-full rounded-full ${barClassName}`}
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

export function SectionTitle({ title, action, onClick }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-soma-900">{title}</h2>
      {action && (
        <button
          onClick={onClick}
          className="flex items-center text-sm font-semibold text-soma-600"
        >
          {action}
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export function Pill({ children, tone = 'green' }) {
  const tones = {
    green: 'bg-soma-100 text-soma-700',
    yellow: 'bg-soma-100 text-soma-800',
    coral: 'bg-soma-50 text-soma-700',
  }

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

export function FormField({ label, className = '', ...props }) {
  return (
    <label className={`block text-sm font-medium text-soma-800 ${className}`}>
      {label}
      <input
        className="mt-2 w-full min-w-0 rounded-xl border border-soma-200 bg-white px-4 py-3 text-soma-900 disabled:opacity-60"
        {...props}
      />
    </label>
  )
}

export function Feedback({ error, message }) {
  if (!error && !message) return null
  return (
    <p
      role={error ? 'alert' : 'status'}
      className={`rounded-xl p-3 text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-soma-100 text-soma-800'}`}
    >
      {error || message}
    </p>
  )
}
