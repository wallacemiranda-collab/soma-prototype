import { ExternalLink } from 'lucide-react'
import { Card } from './ui'

export default function ExternalQuestionnaireCard({
  title,
  description,
  href,
  linkLabel,
}) {
  return (
    <Card>
      <h2 className="font-semibold text-soma-900">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-soma-700">{description}</p>
      <p className="mt-2 text-xs leading-5 text-soma-600">
        O Endo + não recebe nem salva respostas preenchidas no site externo.
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
