import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import MetabolicCard from '../components/MetabolicCard'
import { Feedback, FormField, PrimaryButton } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'
import { usePatient } from '../contexts/PatientContext'
import {
  localDate,
  optionalNumber,
  validateDate,
  validateEntry,
  formatNumber,
} from '../lib/patientData'
import { entryHeight } from '../lib/anthropometry'

const fields = [
  { key: 'weight_kg', label: 'Peso (kg)', min: 0.1, max: 800, step: 'any' },
  { key: 'waist_cm', label: 'Cintura (cm)', min: 1, max: 500, step: 'any' },
  { key: 'sleep_hours', label: 'Sono (horas)', min: 0, max: 24, step: 'any' },
  {
    key: 'activity_minutes',
    label: 'Movimento (minutos)',
    min: 0,
    max: 1440,
    step: '1',
  },
  { key: 'water_liters', label: 'Água (litros)', min: 0, max: 30, step: 'any' },
  {
    key: 'mood_score',
    label: 'Bem-estar (1 a 10)',
    min: 1,
    max: 10,
    step: '1',
  },
]

export default function PatientEntry() {
  const [params] = useSearchParams()
  const { isDemo } = useAuth()
  const { entries, profile, saveEntry } = usePatient()
  const [date, setDate] = useState(() => {
    try {
      return validateDate(params.get('data') || localDate())
    } catch {
      return localDate()
    }
  })
  const [values, setValues] = useState({})
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const existing = entries.find((entry) => entry.entry_date === date)
  const height = entryHeight(profile, existing, date, localDate())
  useEffect(() => {
    setValues(
      Object.fromEntries(
        fields.map(({ key }) => [
          key,
          key === 'sleep_hours'
            ? existing?.sleep_minutes != null
              ? existing.sleep_minutes / 60
              : ''
            : (existing?.[key] ?? ''),
        ]),
      ),
    )
  }, [date, existing])
  async function submit(event) {
    event.preventDefault()
    if (pending) return
    setError('')
    setMessage('')
    setPending(true)
    try {
      const hours = optionalNumber(values.sleep_hours, 0, 24, 'Sono')
      const entry = validateEntry({
        ...values,
        entry_date: date,
        sleep_minutes: hours === null ? null : Math.round(hours * 60),
      })
      await saveEntry(entry)
      setMessage(
        isDemo
          ? 'Registro fictício salvo nesta aba. Nenhum dado foi enviado ao serviço.'
          : 'Registro salvo. Seu histórico já foi atualizado.',
      )
    } catch (failure) {
      const reason =
        failure instanceof Error
          ? failure.message
          : 'Não foi possível salvar. Confira sua conexão e tente novamente.'
      setError(reason)
    } finally {
      setPending(false)
    }
  }
  return (
    <>
      <AppHeader
        title="Meu registro"
        subtitle="Preencha apenas o que deseja acompanhar"
        simple
      />
      <MetabolicCard>
        <form onSubmit={submit} className="space-y-5">
          <FormField
            label="Data"
            type="date"
            value={date}
            min="0001-01-01"
            max={localDate()}
            required
            disabled={pending}
            onChange={(event) => {
              if (event.target.value) {
                setDate(event.target.value)
                setError('')
                setMessage('')
              }
            }}
          />
          <div className="grid grid-cols-2 gap-4">
            {fields.map(({ key, label, ...limits }) => (
              <FormField
                key={key}
                label={label}
                type="number"
                inputMode="decimal"
                {...limits}
                value={values[key] ?? ''}
                disabled={pending}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
              />
            ))}
          </div>
          <p className="text-xs leading-5 text-soma-600">
            Uma anotação por dia. Salvar novamente na mesma data atualiza o
            registro existente.
          </p>
          <p className="text-xs leading-5 text-soma-600">
            Altura de referência: {formatNumber(height, ' cm')}.{' '}
            <Link to="/perfil" className="font-semibold underline">
              Ajustar altura no Perfil
            </Link>
            . Para datas anteriores, usamos somente a altura que já estava
            vinculada à anotação.
          </p>
          {isDemo && (
            <p className="rounded-xl bg-soma-100 p-3 text-sm text-soma-800">
              Use apenas dados fictícios. As alterações da demonstração ficam
              nesta aba e não são enviadas ao serviço. Não informe dados reais.
            </p>
          )}
          <Feedback error={error} message={message} />
          <PrimaryButton type="submit" disabled={pending}>
            {pending
              ? 'Salvando...'
              : existing
                ? 'Atualizar registro'
                : 'Salvar registro'}
          </PrimaryButton>
        </form>
      </MetabolicCard>
      <p className="mt-4 text-xs leading-5 text-soma-600">
        Nascimento e sexo ficam somente no{' '}
        <Link to="/perfil" className="font-semibold underline">
          seu perfil
        </Link>
        .
      </p>
      <Link
        to="/evolucao"
        className="mt-5 inline-block py-3 font-semibold text-soma-600"
      >
        Consultar meu histórico
      </Link>
    </>
  )
}
