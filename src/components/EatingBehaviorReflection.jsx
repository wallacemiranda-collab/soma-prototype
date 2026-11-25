import { useState } from 'react'
import { Card } from './ui'

const topics = [
  {
    id: 'routine',
    title: 'Rotina e organização',
    description:
      'Horários, compromissos e acesso a alimentos podem influenciar como as refeições se encaixam no seu dia.',
    prompt:
      'Como sua rotina e seus horários influenciam o ritmo das suas refeições?',
  },
  {
    id: 'environment',
    title: 'Ambiente e estímulos',
    description:
      'O lugar, as companhias e os estímulos ao redor podem influenciar suas escolhas e sua vontade de comer.',
    prompt:
      'Quais situações ao seu redor costumam influenciar o que ou quando você come?',
  },
  {
    id: 'pace',
    title: 'Ritmo e atenção',
    description:
      'O ritmo da refeição e a atenção ao momento podem variar. Uma experiência isolada não define você nem confirma um transtorno.',
    prompt:
      'Como costuma ser seu ritmo durante as refeições? O que ajuda você a fazer uma pausa?',
  },
  {
    id: 'feelings',
    title: 'Sentimentos e alimentação',
    description:
      'Sentimentos, cansaço ou situações difíceis podem fazer parte do contexto das escolhas alimentares. Observe com acolhimento, sem culpa.',
    prompt:
      'Quais sentimentos ou momentos parecem influenciar sua vontade de comer ou beliscar?',
  },
  {
    id: 'body-cues',
    title: 'Sinais do corpo e satisfação',
    description:
      'A fome, o tamanho das porções e a sensação de satisfação podem mudar conforme a refeição e a situação.',
    prompt:
      'O que costuma ajudar você a perceber a fome e a satisfação durante uma refeição?',
  },
]

export default function EatingBehaviorReflection() {
  const [notes, setNotes] = useState({})
  const [cleared, setCleared] = useState(false)
  const hasNotes = Object.values(notes).some((note) => note.trim())

  function updateNote(id, value) {
    setNotes((current) => ({ ...current, [id]: value }))
    setCleared(false)
  }

  function clearNotes() {
    setNotes({})
    setCleared(true)
  }

  return (
    <Card>
      <h2 className="font-semibold text-soma-900">
        Reflexão sobre comportamento alimentar
      </h2>
      <p className="mt-2 text-sm leading-6 text-soma-700">
        Estes temas ajudam a observar experiências do dia a dia. Uma pessoa
        pode se reconhecer em mais de um tema, ou em nenhum.
      </p>
      <p className="mt-2 text-xs leading-5 text-soma-600">
        Estas perguntas são uma reflexão própria do Endo +, não são a EFCA e
        não reproduzem seus itens, critérios ou pontuação. Não geram diagnóstico
        nem orientam tratamento. São temas de observação, não rótulos sobre
        você. Suas anotações ficam somente no navegador enquanto esta
        tela está aberta; não são enviadas nem salvas pelo Endo +, nem
        compartilhadas com seu profissional. Ao sair desta tela ou atualizar
        a página, elas serão apagadas.
      </p>

      <div className="mt-4 space-y-3">
        {topics.map((topic) => {
          const fieldId = `eating-reflection-${topic.id}`

          return (
            <details
              key={topic.id}
              className="group rounded-2xl border border-soma-100 bg-soma-50/60 p-4"
            >
              <summary className="cursor-pointer font-medium text-soma-900 marker:text-soma-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-soma-700">
                {topic.title}
              </summary>
              <p className="mt-3 text-sm leading-6 text-soma-700">
                {topic.description}
              </p>
              <label
                htmlFor={fieldId}
                className="mt-3 block text-sm font-medium text-soma-800"
              >
                {topic.prompt}
                <textarea
                  id={fieldId}
                  rows={3}
                  maxLength={500}
                  value={notes[topic.id] || ''}
                  onChange={(event) => updateNote(topic.id, event.target.value)}
                  placeholder="Anote algo que queira lembrar para si ou conversar na consulta."
                  className="mt-2 w-full resize-y rounded-xl border border-soma-200 bg-white px-4 py-3 text-sm leading-6 text-soma-900 placeholder:text-soma-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-soma-700"
                />
              </label>
            </details>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          disabled={!hasNotes}
          onClick={clearNotes}
          className="min-h-11 rounded-xl px-3 py-2 text-sm font-semibold text-soma-800 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-soma-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Apagar anotações
        </button>
        {cleared && (
          <p role="status" className="text-sm text-soma-700">
            Anotações apagadas.
          </p>
        )}
      </div>
    </Card>
  )
}
