import { useEffect, useState } from 'react'
import { Card, Feedback } from '../components/ui'
import { calculatorsEnabled } from '../config/calculators.js'
import { useAuth } from '../contexts/AuthContext'
import ExternalQuestionnaireCard from '../components/ExternalQuestionnaireCard'
import EatingBehaviorReflection from '../components/EatingBehaviorReflection'
import { calculatorRepository } from '../services/calculatorService.js'

function scoreLabel(value) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function patientDescription(result) {
  if (result.category === 'age_limited')
    return 'Esta ferramenta tem menor precisão abaixo de 35 anos. Converse com seu médico sobre a avaliação mais adequada.'
  if (result.category === 'low')
    return 'O resultado ficou abaixo do limite de triagem para esta faixa etária. Ele não confirma nem exclui um diagnóstico.'
  if (result.category === 'intermediate')
    return 'O resultado ficou em uma faixa intermediária. Seu médico pode explicar o que isso significa no seu contexto.'
  return 'O resultado ficou acima do limite de triagem. Converse com seu médico; isso não confirma um diagnóstico.'
}

function dateLabel(value) {
  const parsed = new Date(`${value}T12:00:00`)
  return Number.isNaN(parsed.getTime())
    ? 'Data indisponível'
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(parsed)
}

export default function PatientCalculators() {
  const { isDemo, user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    let active = true
    setRows([])
    setError('')
    setLoading(true)
    if (!calculatorsEnabled || isDemo || !user?.id) {
      setLoading(false)
      return () => { active = false }
    }
    calculatorRepository
      .listForPatient()
      .then((results) => {
        if (active) setRows(results)
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar os resultados compartilhados.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [isDemo, user?.id])

  async function hideResult(id) {
    setBusyId(id)
    setError('')
    try {
      await calculatorRepository.setPatientVisibility(id, false)
      setRows((current) => current.filter((row) => row.id !== id))
    } catch {
      setError('Não foi possível ocultar este resultado. Tente novamente.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-soma-950">Calculadoras</h1>
        <p className="mt-1 text-soma-700">
          Recursos externos e resultados compartilhados
        </p>
      </header>

      <Card>
        <h2 className="font-semibold text-soma-900">Uso profissional</h2>
        <p className="mt-2 text-sm leading-6 text-soma-700">
          As fórmulas clínicas ficam na área do profissional. Um resultado do consultório só aparece aqui se o profissional decidir compartilhá-lo e a autorização de acesso estiver ativa.
        </p>
      </Card>

      <section className="space-y-3" aria-labelledby="external-tools-title">
        <h2 id="external-tools-title" className="text-lg font-semibold text-soma-900">
          Questionários em sites externos
        </h2>
        <ExternalQuestionnaireCard
          title="Fenótipos do comportamento alimentar (EFCA)"
          description="A EFCA é uma escala externa. O site pode solicitar um código de acesso; o Endo + não reproduz as perguntas nem calcula o resultado."
          href="https://comportamientoalimentario.com/"
          linkLabel="Acessar plataforma externa da EFCA"
        />

        <EatingBehaviorReflection />

        <ExternalQuestionnaireCard
          title="STOP-Bang"
          description="Questionário externo de triagem para apneia obstrutiva do sono. Enquanto o uso não estiver licenciado no Endo +, acesse a ferramenta no site oficial."
          href="https://www.stopbang.ca/"
          linkLabel="Abrir ferramenta oficial do STOP-Bang"
        />

        <ExternalQuestionnaireCard
          title="Escala de Sonolência de Epworth"
          description="O Endo + não reproduz a escala. Enquanto o uso não estiver licenciado, acesse o site oficial do instrumento."
          href="https://epworthsleepinessscale.com/"
          linkLabel="Acessar o site oficial da Epworth"
        />

        <p className="px-1 text-xs leading-5 text-soma-600">
          Estes links abrem outros sites. O Endo + não recebe as respostas preenchidas neles.
        </p>
      </section>

      {calculatorsEnabled && (
        <section className="space-y-3" aria-labelledby="shared-calculators-title">
          <h2 id="shared-calculators-title" className="text-lg font-semibold text-soma-900">
            Resultados que seu profissional compartilhou
          </h2>
          {isDemo ? (
            <Card>
              <p className="text-sm text-soma-700">
                A demonstração usa apenas dados fictícios e não carrega resultados clínicos.
              </p>
            </Card>
          ) : loading ? (
            <p role="status" className="text-sm text-soma-600">Carregando resultados...</p>
          ) : rows.length ? rows.map((row) => (
            <Card key={row.id}>
              <p className="text-sm text-soma-600">Exame de {dateLabel(row.test_date)}</p>
              <h3 className="mt-1 font-semibold text-soma-900">
                {row.calculator_key === 'fib4' ? 'FIB-4' : 'Resultado de calculadora'}
              </h3>
              <p className="mt-2 text-3xl font-semibold text-soma-950">
                {scoreLabel(row.result.score)}
              </p>
              <p className="mt-2 text-sm leading-6 text-soma-700">
                {patientDescription(row.result)}
              </p>
              <p className="mt-3 text-xs leading-5 text-soma-600">
                Este resultado é uma triagem e não substitui avaliação médica. Converse com seu médico.
              </p>
              <button
                type="button"
                disabled={busyId === row.id}
                onClick={() => hideResult(row.id)}
                className="mt-3 py-2 text-sm font-semibold text-soma-700 underline disabled:opacity-50"
              >
                Ocultar este resultado
              </button>
            </Card>
          )) : (
            <Card>
              <p className="text-sm text-soma-700">
                {isDemo
                  ? 'Nenhum resultado clínico é carregado na demonstração.'
                  : 'Ainda não há resultados compartilhados com você.'}
              </p>
            </Card>
          )}
        </section>
      )}
      {error && <Feedback error={error} />}
    </div>
  )
}
