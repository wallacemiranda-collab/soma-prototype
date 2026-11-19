import { ExternalLink, Search, Youtube } from 'lucide-react'
import { useState } from 'react'
import AppHeader from '../components/AppHeader'
import MetabolicCard from '../components/MetabolicCard'

const channel = 'https://www.youtube.com/@WallaceMiranda'
const topics = [
  {
    title: 'Sono e descanso',
    query: 'sono',
    description: 'Explore os conteúdos sobre sono no canal.',
  },
  {
    title: 'Alimentação',
    query: 'alimentação',
    description: 'Encontre conversas sobre alimentação e rotina.',
  },
  {
    title: 'Metabolismo e diabetes',
    query: 'diabetes',
    description:
      'Conheça os temas de endocrinologia abordados pelo Dr. Wallace.',
  },
]

export default function Education() {
  const [query, setQuery] = useState('')
  const visible = topics.filter((topic) =>
    topic.title
      .toLocaleLowerCase('pt-BR')
      .includes(query.trim().toLocaleLowerCase('pt-BR')),
  )
  return (
    <>
      <AppHeader
        title="Educação"
        subtitle="Aprenda com o Dr. Wallace Miranda"
        simple
      />
      <label className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card">
        <Search size={20} className="text-soma-500" />
        <input
          aria-label="Buscar assuntos"
          placeholder="Buscar assuntos"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </label>
      <MetabolicCard emphasis className="mt-5">
        <Youtube size={32} className="text-soma-200" />
        <h2 className="mt-4 text-xl font-semibold">
          Wallace Miranda no YouTube
        </h2>
        <p className="mt-3 text-sm leading-6 text-soma-100">
          Vídeos e entrevistas para ampliar suas conversas sobre saúde. Os
          conteúdos não substituem uma avaliação individual.
        </p>
        <a
          href={channel}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 font-semibold text-soma-800"
        >
          Acessar canal
          <ExternalLink size={16} />
        </a>
      </MetabolicCard>
      <h2 className="mb-4 mt-7 text-lg font-semibold">Explorar assuntos</h2>
      <div className="space-y-3">
        {visible.map((topic) => (
          <MetabolicCard key={topic.query}>
            <h3 className="font-semibold">{topic.title}</h3>
            <p className="mt-2 text-sm text-soma-600">{topic.description}</p>
            <a
              href={`${channel}/search?query=${encodeURIComponent(topic.query)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-soma-600"
            >
              Explorar no YouTube
              <ExternalLink size={15} />
            </a>
          </MetabolicCard>
        ))}
      </div>
      {!visible.length && (
        <MetabolicCard>
          <p className="text-sm text-soma-600">
            Não encontramos esse assunto na lista. Você pode buscar diretamente
            no canal.
          </p>
          <a
            href={`${channel}/search?query=${encodeURIComponent(query.trim())}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block font-semibold text-soma-600"
          >
            Buscar no canal
          </a>
        </MetabolicCard>
      )}
    </>
  )
}
