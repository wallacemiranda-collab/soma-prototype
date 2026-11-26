import { ExternalLink } from 'lucide-react'
import { Card } from './ui'

export default function ExternalToolCard({
  title,
  description,
  href,
  linkLabel,
}) {
  return (
    <Card>
      <h3 className="font-semibold text-soma-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-soma-700">{description}</p>
      <p className="mt-2 text-xs leading-5 text-soma-600">
        O Endo + não preenche nem salva respostas destes sites. Consulte a política de privacidade do serviço externo.
      </p>
      <a
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-soma-50 px-4 py-3 text-sm font-semibold text-soma-800 underline"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {linkLabel}
        <ExternalLink size={16} aria-hidden="true" />
      </a>
    </Card>
  )
}
