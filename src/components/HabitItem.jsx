import { Activity, Apple, Check, HeartPulse, MoonStar } from 'lucide-react'

const icons = { Activity, Apple, HeartPulse, MoonStar }

export default function HabitItem({ habit, onToggle, compact = false }) {
  const Icon = icons[habit.icon]

  return (
    <button
      onClick={() => onToggle?.(habit.id)}
      className={`flex w-full items-center gap-3 rounded-2xl text-left transition ${
        compact ? 'py-2.5' : 'bg-white p-4 shadow-card'
      }`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-soma-50 text-soma-700">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block font-medium text-soma-900 ${habit.done ? 'line-through opacity-55' : ''}`}>
          {habit.title}
        </span>
        <span className="text-xs text-soma-600">{habit.time}</span>
      </span>
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
          habit.done ? 'border-soma-500 bg-soma-500 text-white' : 'border-soma-200'
        }`}
      >
        {habit.done && <Check className="h-4 w-4" />}
      </span>
    </button>
  )
}
