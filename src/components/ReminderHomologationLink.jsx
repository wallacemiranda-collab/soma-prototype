import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { remindersHomologationEnabled } from '../config/reminders.js'
import { useAuth } from '../contexts/AuthContext'
import { isSyntheticPatient } from '../lib/reminderFeature.js'

export default function ReminderHomologationLink() {
  const { user } = useAuth()
  if (!remindersHomologationEnabled || !isSyntheticPatient(user?.email))
    return null
  return (
    <Link
      to="/lembretes"
      className="mb-5 flex items-center gap-3 rounded-2xl border border-soma-200 bg-white p-4 font-semibold text-soma-800"
    >
      <Bell size={22} aria-hidden="true" className="shrink-0" />
      <span>
        Configurar lembretes
        <span className="mt-1 block text-xs font-normal">
          Prévia conectada ao ambiente de testes
        </span>
      </span>
    </Link>
  )
}
