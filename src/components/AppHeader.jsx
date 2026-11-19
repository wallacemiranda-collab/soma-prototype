import { Link } from 'react-router-dom'
import { usePatient } from '../contexts/PatientContext'
import { initials } from '../lib/patientData'

export default function AppHeader({ title, subtitle, simple = false }) {
  const { fullName } = usePatient()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  return (
    <header className="mb-6 flex items-start justify-between gap-3">
      <div className="min-w-0">
        {!simple && <p className="mb-1 text-sm text-soma-600">{greeting},</p>}
        <h1 className="break-words text-2xl font-semibold text-soma-900">
          {simple ? title : `${fullName.split(' ')[0]}!`}
        </h1>
        {subtitle && <p className="mt-2 text-sm text-soma-600">{subtitle}</p>}
      </div>
      <Link
        to="/perfil"
        aria-label="Abrir meu perfil"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-soma-100 font-semibold text-soma-700"
      >
        {initials(fullName)}
      </Link>
    </header>
  )
}
