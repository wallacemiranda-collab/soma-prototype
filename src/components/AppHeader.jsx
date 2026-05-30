import { Bell } from 'lucide-react'
import { user } from '../data/mockData'

export default function AppHeader({ title, subtitle, simple = false }) {
  if (simple) {
    return (
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-soma-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-soma-600">{subtitle}</p>}
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-soma-100 font-semibold text-soma-700">
          {user.avatar}
        </div>
      </header>
    )
  }

  return (
    <header className="mb-7 flex items-center justify-between pt-2">
      <div>
        <p className="text-sm text-soma-600">{user.greeting},</p>
        <h1 className="text-2xl font-semibold text-soma-900">{user.name}!</h1>
      </div>
      <div className="flex items-center gap-3">
        <button aria-label="Notificações" className="relative rounded-full bg-white p-3 shadow-card">
          <Bell className="h-5 w-5 text-soma-800" />
          <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-rose" />
        </button>
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-soma-800 text-sm font-semibold text-white">
          {user.avatar}
        </div>
      </div>
    </header>
  )
}
