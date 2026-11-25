import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card, Feedback, FormField, PrimaryButton } from '../components/ui'
import { useDoctor } from '../components/DoctorShell'
import { calculatorsEnabled } from '../config/calculators.js'
import {
  ageAtDate,
  calculateFib4,
  fib4Interpretation,
  fib4References,
} from '../lib/fib4.js'
import { localDate } from '../lib/patientData.js'
import { calculatorRepository } from '../services/calculatorService.js'
import { sharingRepository } from '../services/sharingService.js'
import DoctorCalculatorTools from '../components/DoctorCalculatorTools.jsx'

function dateLabel(value) {
  if (!value) return 'Data indisponível'
  const parsed = new Date(`${value}T12:00:00`)
  return Number.isNaN(parsed.getTime())
    ? 'Data indisponível'
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(parsed)
}

function scoreLabel(value) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export default function DoctorCalculator() {
  const { patientId } = useParams()
  const { profile: professional } = useDoctor()
  const [initialTestDate] = useState(() => localDate())
  const [patient, setPatient] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState(null)
  const [form, setForm] = useState({
    age_years: '',
    ast_u_l: '',
    alt_u_l: '',
    platelets_10e9_l: '',
    test_date: initialTestDate,
  })

  useEffect(() => {
    let active = true
    Promise.all([
      sharingRepository.loadPatientProfile(patientId),
      calculatorRepository.listForDoctor(patientId),
    ])
      .then(async ([profile, rows]) => {
        if (!active) return
        if (!(await sharingRepository.canRead(patientId)))
          throw new Error('Patient authorization required')
        if (!active) return
        setPatient(profile)
        setHistory(rows)
        const age = ageAtDate(profile.birth_date, initialTestDate)
        if (age !== null)
          setForm((current) => ({ ...current, age_years: `${age}` }))
      })
      .catch(() => {
        if (active)
          setError('Não foi possível confirmar a autorização profissional ativa.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [initialTestDate, patientId])

  useEffect(() => {
    let active = true
    let checking = false
    async function verifyAccess() {
      if (!active || checking) return
      checking = true
      try {
        if (!(await sharingRepository.canRead(patientId)) && active) {
          setPatient(null)
          setHistory([])
          setPreview(null)
          setForm((current) => ({
            ...current,
            age_years: '',
            ast_u_l: '',
            alt_u_l: '',
            platelets_10e9_l: '',
          }))
          setError('A autorização para este prontuário foi encerrada ou revogada.')
        }
      } catch {
        if (active) {
          setPatient(null)
          setHistory([])
          setPreview(null)
          setForm((current) => ({
            ...current,
            age_years: '',
            ast_u_l: '',
            alt_u_l: '',
            platelets_10e9_l: '',
          }))
          setError('Não foi possível confirmar a autorização profissional.')
        }
      } finally {
        checking = false
      }
    }
    const interval = window.setInterval(verifyAccess, 30000)
    window.addEventListener('focus', verifyAccess)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('focus', verifyAccess)
    }
  }, [patientId])

  const ageOnExamDate = ageAtDate(patient?.birth_date, form.test_date)

  function change(event) {
    const { name, value } = event.target
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'test_date' && patient?.birth_date
        ? { age_years: `${ageAtDate(patient.birth_date, value) ?? ''}` }
        : {}),
    }))
    setPreview(null)
    setError('')
    setMessage('')
  }

  function calculate(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    try {
      setPreview(calculateFib4(form))
    } catch (cause) {
      setPreview(null)
      setError(cause.message)
    }
  }

  async function save() {
    if (!preview) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const row = await calculatorRepository.saveDoctorFib4(patientId, form)
      setHistory((current) => [row, ...current])
      setPreview(row.result)
      setMessage('Resultado salvo no histórico profissional, ainda privado para o paciente.')
    } catch {
      setError('Não foi possível salvar. Confirme a autorização e tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  async function changeVisibility(row) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const updated = await calculatorRepository.setPatientVisibility(
        row.id,
        !row.shared_with_patient,
      )
      setHistory((current) =>
        current.map((item) =>
          item.id === row.id
            ? { ...item, shared_with_patient: updated.shared_with_patient }
            : item,
        ),
      )
      setMessage(
        updated.shared_with_patient
          ? 'Este resultado foi compartilhado com o paciente.'
          : 'O compartilhamento deste resultado foi revogado.',
      )
    } catch {
      setError('Não foi possível alterar o compartilhamento deste resultado.')
    } finally {
      setBusy(false)
    }
  }

  if (!calculatorsEnabled || professional?.council !== 'CRM')
    return <Feedback error="Esta calculadora está disponível somente para médicos na prévia autorizada." />

  if (loading) return <p role="status">Confirmando acesso autorizado...</p>
  if (error && !patient)
    return (
      <>
        <Feedback error={error} />
        <Link to={`/profissional/pacientes/${patientId}`} className="mt-4 inline-block font-semibold text-soma-700">
          Voltar ao prontuário
        </Link>
      </>
    )

  const under18 = ageOnExamDate !== null && ageOnExamDate < 18

  return (
    <div className="space-y-5">
      <Link
        to={`/profissional/pacientes/${patientId}`}
        className="inline-block py-2 text-sm font-semibold text-soma-700"
      >
        Voltar ao prontuário
      </Link>
      <header>
        <p className="text-sm text-soma-600">Calculadora profissional</p>
        <h1 className="text-2xl font-semibold text-soma-950">FIB-4</h1>
        <p className="mt-1 text-soma-700">Paciente: {patient?.full_name || 'Paciente'}</p>
      </header>

      <Card>
        <p className="text-sm leading-6 text-soma-700">
          Ferramenta de triagem inicial para estratificação do risco de fibrose na MASLD. Informe a idade na data do exame e os valores laboratoriais correspondentes.
        </p>
        <p className="mt-3 rounded-xl bg-soma-50 p-3 text-sm text-soma-800">
          Não usar durante doença aguda. A interpretação tem menor precisão abaixo de 35 anos. A classificação é uma triagem, não um diagnóstico.
        </p>
      </Card>

      <Card>
        <form onSubmit={calculate} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label="Data do exame"
              name="test_date"
              type="date"
              value={form.test_date}
              onChange={change}
              max={localDate()}
              required
            />
            <FormField
              label="Idade na data do exame (anos)"
              name="age_years"
              type="number"
              min="18"
              max="120"
              step="1"
              value={form.age_years}
              onChange={change}
              readOnly={Boolean(patient?.birth_date)}
              required
            />
            <FormField
              label="AST (U/L)"
              name="ast_u_l"
              type="number"
              min="1"
              max="1000"
              step="any"
              value={form.ast_u_l}
              onChange={change}
              required
            />
            <FormField
              label="ALT (U/L)"
              name="alt_u_l"
              type="number"
              min="1"
              max="1000"
              step="any"
              value={form.alt_u_l}
              onChange={change}
              required
            />
            <FormField
              label="Plaquetas (10⁹/L)"
              name="platelets_10e9_l"
              type="number"
              min="10"
              max="1000"
              step="any"
              value={form.platelets_10e9_l}
              onChange={change}
              required
            />
          </div>
          {under18 && <Feedback error="O FIB-4 desta prévia não aceita menores de 18 anos." />}
          <PrimaryButton type="submit" disabled={under18}>
            Calcular FIB-4
          </PrimaryButton>
        </form>
      </Card>

      {preview && (
        <Card>
          <p className="text-sm font-semibold text-soma-700">Resultado da triagem</p>
          <p className="mt-2 text-4xl font-semibold text-soma-950">{scoreLabel(preview.score)}</p>
          <p className="mt-2 font-medium text-soma-800">{fib4Interpretation(preview)}</p>
          <p className="mt-3 text-sm text-soma-700">
            Faixas de triagem para MASLD: abaixo de {scoreLabel(preview.low_cutoff)}, intermediária até 2,67 e acima de 2,67. A partir de 65 anos, o primeiro corte é 2,00. Abaixo de 35 anos, a faixa não é classificada.
          </p>
          <p className="mt-3 text-xs leading-5 text-soma-600">
            Este resultado é uma triagem e não substitui avaliação médica. Converse com seu médico.
          </p>
          <PrimaryButton
            type="button"
            className="mt-4"
            disabled={busy || under18}
            onClick={save}
          >
            Salvar no histórico profissional
          </PrimaryButton>
        </Card>
      )}

      <DoctorCalculatorTools />

      <Card>
        <h2 className="font-semibold text-soma-900">Referências</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {fib4References.map((reference) => (
            <li key={reference.url}>
              <a className="underline" href={reference.url} target="_blank" rel="noreferrer">
                {reference.label}
              </a>
            </li>
          ))}
        </ul>
      </Card>

      <section className="space-y-3" aria-labelledby="fib4-history-title">
        <h2 id="fib4-history-title" className="text-lg font-semibold text-soma-900">
          Histórico profissional
        </h2>
        {history.length ? history.map((row) => (
          <Card key={row.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-soma-600">Exame de {dateLabel(row.test_date)}</p>
                <p className="mt-1 text-2xl font-semibold text-soma-950">{scoreLabel(row.result.score)}</p>
                <p className="mt-1 text-sm text-soma-700">{fib4Interpretation(row.result)}</p>
              </div>
              <span className="rounded-full bg-soma-100 px-3 py-1 text-xs font-semibold text-soma-800">
                {row.shared_with_patient ? 'Compartilhado' : 'Privado'}
              </span>
            </div>
            <p className="mt-3 text-xs text-soma-600">
              Valores laboratoriais ficam visíveis somente à equipe profissional autorizada.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => changeVisibility(row)}
              className="mt-3 py-2 text-sm font-semibold text-soma-700 underline disabled:opacity-50"
            >
              {row.shared_with_patient
                ? 'Revogar compartilhamento com o paciente'
                : 'Compartilhar este resultado com o paciente'}
            </button>
          </Card>
        )) : (
          <Card><p className="text-sm text-soma-700">Nenhum cálculo profissional foi salvo neste prontuário.</p></Card>
        )}
      </section>

      {error && <Feedback error={error} />}
      {message && <Feedback message={message} />}
    </div>
  )
}
