import { Link } from 'react-router-dom'
import { useClinicalPreview } from '../contexts/ClinicalPreviewContext'

export default function ClinicalPreviewLink() {
  const preview = useClinicalPreview()
  if (!preview?.enabled) return null
  return (
    <Link
      to="/modulos"
      className="my-5 block rounded-2xl border border-soma-200 bg-white p-5 font-semibold text-soma-800"
    >
      Conhecer os módulos clínicos
      <span className="mt-1 block text-xs font-normal">
        Prévia da Fase 2 · somente dados fictícios
      </span>
    </Link>
  )
}
