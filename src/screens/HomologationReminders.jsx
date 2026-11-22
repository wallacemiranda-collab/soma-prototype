import { BellOff, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import { Card, Feedback, FormField, PrimaryButton, SelectField } from '../components/ui'
import { remindersHomologationEnabled } from '../config/reminders.js'
import { useAuth } from '../contexts/AuthContext'
import {
  emptyReminderPreview,
  reminderKinds,
  weekdays,
} from '../lib/reminderPreview.js'
import { isSyntheticPatient } from '../lib/reminderFeature.js'
import { reminderRepository } from '../services/somaDataService.js'

const zones = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Belem',
  'America/Rio_Branco',
  'America/Noronha',
  'UTC',
]
const titles = {
  medication: 'Lembrete de rotina com medicamento',
  application: 'Lembrete de rotina semanal',
  weight: 'Pesagem semanal',
  daily: 'Registro diário',
}

export default function HomologationReminders() {
  const { user, isDemo } = useAuth()
  const [value, setValue] = useState(() =>
    emptyReminderPreview(Intl.DateTimeFormat().resolvedOptions().timeZone),
  )
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [hasActiveConsent, setHasActiveConsent] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    if (!user?.id) return undefined
    reminderRepository
      .load(user.id)
      .then((result) => {
        if (!active) return
        setValue(result.value)
        setConsentAccepted(result.consented)
        setHasActiveConsent(result.consented)
      })
      .catch(() => {
        if (active)
          setError('Não foi possível carregar os lembretes da conta de teste.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user?.id])

  if (
    !remindersHomologationEnabled ||
    isDemo ||
    !isSyntheticPatient(user?.email)
  )
    return <Navigate to="/home" replace />

  function change(patch) {
    setValue((current) => ({ ...current, ...patch }))
    setMessage('')
    setError('')
  }

  function changeRule(id, patch) {
    change({
      rules: value.rules.map((rule) =>
        rule.id === id ? { ...rule, ...patch } : rule,
      ),
    })
  }

  async function save(event) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError('')
    setMessage('')
    try {
      const result = await reminderRepository.save(user.id, value, {
        consentAccepted,
      })
      setValue(result.value)
      setConsentAccepted(result.consented)
      setHasActiveConsent(result.consented)
      setMessage('Preferências salvas na sua conta fictícia de homologação.')
    } catch (failure) {
      setError(failure.message || 'Não foi possível salvar os lembretes.')
    } finally {
      setPending(false)
    }
  }

  async function revoke() {
    if (pending) return
    setPending(true)
    setError('')
    setMessage('')
    try {
      const result = await reminderRepository.revoke(user.id)
      setValue(result.value)
      setConsentAccepted(false)
      setHasActiveConsent(false)
      setMessage(
        'Autorização revogada; a agenda foi desligada e seus horários foram apagados.',
      )
    } catch {
      setError('Não foi possível revogar agora. Tente novamente.')
    } finally {
      setPending(false)
    }
  }

  if (loading)
    return (
      <>
        <AppHeader title="Meus lembretes" simple />
        <p role="status">Carregando suas preferências de homologação...</p>
      </>
    )

  return (
    <>
      <AppHeader
        title="Meus lembretes"
        subtitle="Defina seus horários na conta fictícia de testes"
        simple
      />
      <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <p className="font-semibold">Homologação: sem notificações enviadas</p>
        <p className="mt-1">
          Seus horários serão salvos no Supabase de testes. O envio ao celular,
          notificações push e agendamento automático continuam desligados.
          Use somente uma conta e informações fictícias.
        </p>
      </div>

      <form onSubmit={save} className="space-y-4">
        <Card>
          <h2 className="font-semibold">Sua agenda</h2>
          <label className="mt-4 flex items-start gap-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={value.enabled}
              onChange={(event) => change({ enabled: event.target.checked })}
              className="mt-1 h-5 w-5 shrink-0 accent-soma-800"
            />
            Ativar minha agenda salva
          </label>
          <SelectField
            label="Fuso horário"
            value={value.timeZone}
            onChange={(event) => change({ timeZone: event.target.value })}
            className="mt-4"
          >
            {[...new Set([value.timeZone, ...zones])].map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </SelectField>
        </Card>

        {reminderKinds.map((kind) => {
          const rule = value.rules.find((row) => row.id === kind.id)
          return (
            <Card key={kind.id}>
              <label className="flex items-start gap-3 font-semibold">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(event) =>
                    changeRule(kind.id, { enabled: event.target.checked })
                  }
                  className="mt-0.5 h-5 w-5 shrink-0 accent-soma-800"
                />
                {titles[kind.id]}
              </label>
              <p className="mt-2 text-xs leading-5 text-soma-600">
                {kind.frequency === 'weekly'
                  ? 'Você escolhe um dia e horário, conforme sua própria rotina.'
                  : 'Você escolhe o horário da sua rotina.'}
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <FormField
                  label={`Horário: ${titles[kind.id]}`}
                  type="time"
                  required
                  value={rule.time}
                  onChange={(event) =>
                    changeRule(kind.id, { time: event.target.value })
                  }
                />
                {kind.frequency === 'weekly' && (
                  <SelectField
                    label={`Dia: ${titles[kind.id]}`}
                    value={rule.weekday}
                    onChange={(event) =>
                      changeRule(kind.id, {
                        weekday: Number(event.target.value),
                      })
                    }
                  >
                    {weekdays.map((day, index) => (
                      <option value={index} key={day}>
                        {day}
                      </option>
                    ))}
                  </SelectField>
                )}
              </div>
            </Card>
          )
        })}

        <Card>
          <h2 className="font-semibold">Período de silêncio</h2>
          <label className="mt-4 flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={value.quiet.enabled}
              onChange={(event) =>
                change({
                  quiet: { ...value.quiet, enabled: event.target.checked },
                })
              }
              className="mt-0.5 h-5 w-5 shrink-0 accent-soma-800"
            />
            Respeitar período de silêncio na agenda
          </label>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <FormField
              label="Silêncio começa"
              type="time"
              required
              value={value.quiet.start}
              onChange={(event) =>
                change({ quiet: { ...value.quiet, start: event.target.value } })
              }
            />
            <FormField
              label="Silêncio termina"
              type="time"
              required
              value={value.quiet.end}
              onChange={(event) =>
                change({ quiet: { ...value.quiet, end: event.target.value } })
              }
            />
          </div>
        </Card>

        <Card>
          <label className="flex items-start gap-3 text-sm leading-6">
            <input
              type="checkbox"
              checked={consentAccepted}
              onChange={(event) => setConsentAccepted(event.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-soma-800"
            />
            <span>
              Autorizo salvar estes horários na minha conta fictícia do ambiente
              de homologação. Entendo que nenhum alerta será enviado ao celular
              nesta prévia e posso revogar esta autorização a qualquer momento.
            </span>
          </label>
          <p className="mt-3 text-xs leading-5 text-soma-600">
            O Endo + não define medicamentos, doses ou tratamentos. Siga a
            orientação do seu profissional de saúde.
          </p>
        </Card>

        <Feedback error={error} message={message} />
        <PrimaryButton type="submit" disabled={pending} className="gap-2">
          <Save size={18} aria-hidden="true" />
          {pending ? 'Salvando...' : 'Salvar preferências'}
        </PrimaryButton>
      </form>

      <button
        type="button"
        onClick={revoke}
        disabled={pending || !hasActiveConsent}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-soma-200 bg-white px-4 py-4 font-semibold text-soma-800 disabled:opacity-50"
      >
        <BellOff size={20} aria-hidden="true" />
        Revogar e apagar meus horários
      </button>
      <p className="mt-5 text-xs leading-5 text-soma-600">
        Esta prévia salva somente a agenda e o registro de autorização na conta
        fictícia. Ela não monitora o relógio, não pede permissão de notificações
        e não envia mensagens ao paciente ou ao profissional.
      </p>
    </>
  )
}
