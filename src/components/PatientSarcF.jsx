import { useState } from 'react'
import { Card, Feedback, PrimaryButton, SelectField } from './ui'
import { calculateSarcF, sarcFReferences } from '../lib/sarcF.js'

const questions = [
  {
    key: 'strength',
    label: 'Qual é sua dificuldade para levantar e carregar 5 kg?',
    options: [
      ['0', 'Nenhuma'],
      ['1', 'Alguma'],
      ['2', 'Muita ou não consegue'],
    ],
  },
  {
    key: 'walking',
    label: 'Qual é sua dificuldade para atravessar um cômodo?',
    options: [
      ['0', 'Nenhuma'],
      ['1', 'Alguma'],
      ['2', 'Muita, usa apoio ou não consegue'],
    ],
  },
  {
    key: 'chair',
    label: 'Qual é sua dificuldade para levantar de uma cama ou cadeira?',
    options: [
      ['0', 'Nenhuma'],
      ['1', 'Alguma'],
      ['2', 'Muita ou não consegue sem ajuda'],
    ],
  },
  {
    key: 'stairs',
    label: 'Qual é sua dificuldade para subir um lance de escadas com 10 degraus?',
    options: [
      ['0', 'Nenhuma'],
      ['1', 'Alguma'],
      ['2', 'Muita ou não consegue'],
    ],
  },
  {
    key: 'falls',
    label: 'Quantas vezes você caiu no último ano?',
    options: [
      ['0', 'Nenhuma'],
      ['1', 'De 1 a 3 vezes'],
      ['2', '4 vezes ou mais'],
    ],
  },
]

export default function PatientSarcF() {
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  function submit(event) {
    event.preventDefault()
    setError('')
    setResult(null)
    try {
      setResult(calculateSarcF(answers))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Confira suas respostas.')
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-soma-900">SARC-F</h2>
      <p className="mt-2 text-sm leading-6 text-soma-700">
        Questionário de triagem de dificuldades relacionadas à força e à mobilidade.
        Esta prévia não salva respostas nem resultado. A versão brasileira foi
        estudada em pessoas com 60 anos ou mais; a interpretação em outras idades
        deve ser feita por um profissional.
      </p>
      <p className="mt-3 rounded-xl bg-soma-50 p-3 text-sm leading-6 text-soma-800">
        Se você usa um medicamento da classe GLP-1 ou está perdendo peso,
        converse com seu profissional sobre acompanhamento de força e massa
        muscular. Este questionário não avalia o efeito de medicamentos e não
        orienta mudanças no tratamento.
      </p>

      <form className="mt-5 space-y-4" onSubmit={submit} noValidate>
        {questions.map(({ key, label, options }) => (
          <SelectField
            key={key}
            label={label}
            value={answers[key] ?? ''}
            onChange={(event) => {
              setAnswers((current) => ({ ...current, [key]: event.target.value }))
              setResult(null)
              setError('')
            }}
            required
          >
            <option value="">Selecione</option>
            {options.map(([value, text]) => (
              <option key={value} value={value}>{text}</option>
            ))}
          </SelectField>
        ))}
        <Feedback error={error} />
        <PrimaryButton type="submit">Calcular prévia</PrimaryButton>
      </form>

      {result && (
        <div className="mt-5 rounded-2xl bg-soma-100 p-4" role="status">
          <p className="text-sm font-medium text-soma-800">Pontuação SARC-F</p>
          <p className="mt-1 text-3xl font-semibold text-soma-950">
            {result.score} <span className="text-base font-medium">/ {result.maxScore}</span>
          </p>
          <p className="mt-2 text-sm leading-6 text-soma-800">
            {result.suggestive
              ? 'Pontuação igual ou superior a 4: sugere avaliação complementar por um profissional.'
              : 'Pontuação abaixo de 4: não atingiu o corte tradicional, mas isso não descarta sarcopenia ou perda de força.'}
          </p>
          <p className="mt-3 text-xs leading-5 text-soma-700">
            O SARC-F pode não identificar todos os casos. Não é diagnóstico e não
            substitui avaliação de força e massa muscular.
          </p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-x-3 gap-y-2 border-t border-soma-100 pt-4 text-xs text-soma-600">
        {sarcFReferences.map((reference) => (
          <a
            key={reference.url}
            href={reference.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {reference.title}
          </a>
        ))}
      </div>
    </Card>
  )
}
