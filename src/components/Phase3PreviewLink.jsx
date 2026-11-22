import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { phase3Preview } from '../config/phase3Preview'

export default function Phase3PreviewLink() {
  const { isDemo } = useAuth()
  if (!phase3Preview.allowed || !isDemo) return null
  return (
    <Link
      to="/lembretes"
      className="mb-5 flex items-center gap-3 rounded-2xl border border-soma-200 bg-white p-4 font-semibold text-soma-800"
    >
      <Bell size={22} aria-hidden="true" className="shrink-0" />
      <span>
        Experimentar lembretes
        <span className="mt-1 block text-xs font-normal">
          Fase 3 · simulação sem notificações reais
        </span>
      </span>
    </Link>
  )
}
