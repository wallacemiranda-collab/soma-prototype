import { Link } from 'react-router-dom'
import { clinicalIntegrationEnabled } from '../config/clinicalPreview'
import { useAuth } from '../contexts/AuthContext'

export default function ClinicalAccessLink() {
  const { isDemo } = useAuth()
  if (!clinicalIntegrationEnabled || isDemo) return null
  return (
    <Link
      to="/cuidados"
      className="my-5 block rounded-2xl bg-white p-5 font-semibold text-soma-800"
    >
      Meus acompanhamentos clínicos
    </Link>
  )
}
