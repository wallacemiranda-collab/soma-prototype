import { Bell, BellOff, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import {
  Card,
  Feedback,
  FormField,
  PrimaryButton,
  SelectField,
} from '../components/ui'
import { useAuth } from '../contexts/AuthContext'
import {
  reminderKinds,
  reminderPreviewStore,
  simulateReminderPreview,
  validateReminderPreview,
  weekdays,
} from '../lib/reminderPreview'

const zones = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Belem',
  'America/Rio_Branco',
  'America/Noronha',
  'UTC',
]

export default function ReminderPreview() {
  const { isDemo } = useAuth()
  const [value, setValue] = useState(() =>
    reminderPreviewStore.read(Intl.DateTimeFormat().resolvedOptions().timeZone),
  )
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [clock, setClock] = useState({ time: '08:00', weekday: 1 })
  const [simulation, setSimulation] = useState(null)
  if (!isDemo) return <Navigate to="/home" replace />
  function change(patch) {
    setValue((old) => ({ ...old, ...patch }))
    setMessage('')
    setError('')
    setSimulation(null)
  }
  function changeRule(id, patch) {
    change({
      rules: value.rules.map((rule) =>
        rule.id === id ? { ...rule, ...patch } : rule,
      ),
    })
  }
  function save(event) {
    event.preventDefault()
    try {
      setValue(reminderPreviewStore.save(value))
      setError('')
      setSimulation(null)
      setMessage(
        reminderPreviewStore.isPersistent()
          ? 'Simulação salva somente nesta aba. Nenhum lembrete real foi agendado.'
          : 'Simulação mantida somente em memória. A recarga pode perder os ajustes; nenhum lembrete real foi agendado.',
      )
    } catch (failure) {
      setError(failure.message)
      setMessage('')
    }
  }
  function stop() {
    const next = {
      ...value,
      enabled: false,
      rules: value.rules.map((rule) => ({ ...rule, enabled: false })),
    }
    // Even an invalid, unsaved form must not prevent the one-touch stop.
    reminderPreviewStore.clear()
    setValue(next)
    setError('')
    setSimulation(null)
    try {
      reminderPreviewStore.save(next)
    } catch {
      /* The empty store is disabled on reload. */
    }
    setMessage(
      'Todos os lembretes da simulação foram desligados. Nenhuma notificação real foi enviada.',
    )
  }
  function testClock(event) {
    event.preventDefault()
    try {
      setSimulation(
        simulateReminderPreview(validateReminderPreview(value), clock),
      )
      setError('')
    } catch (failure) {
      setError(failure.message)
      setSimulation(null)
    }
  }
  return (
    <>
      <AppHeader
        title="Meus lembretes"
        subtitle="Experimente uma rotina que cabe no seu dia"
        simple
      />
      <p className="mb-5 rounded-2xl border border-soma-200 bg-white p-4 text-sm leading-6 text-soma-700">
        Simulação: use horários fictícios. Nada será enviado ao celular, ao
        médico ou ao serviço. Esta tela não configura um tratamento.
      </p>
      <Link
        to="/instalar"
        className="mb-5 flex items-center gap-3 rounded-2xl bg-soma-100 p-4 font-semibold text-soma-800"
      >
        <Smartphone size={22} aria-hidden="true" />
        Instalar esta prévia no celular
      </Link>
      <form onSubmit={save} className="space-y-4">
        <Card>
          <h2 className="font-semibold">Você escolhe quando lembrar</h2>
          <label className="mt-4 flex items-start gap-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={value.enabled}
              onChange={(event) => change({ enabled: event.target.checked })}
              className="mt-1 h-5 w-5 shrink-0 accent-soma-800"
            />
            Ativar simulação de lembretes
          </label>
          <SelectField
            label="Fuso dos horários fictícios"
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
                {kind.label}
              </label>
              <p className="mt-2 text-xs text-soma-600">
                {kind.frequency === 'weekly'
                  ? 'Uma vez por semana, somente no ensaio.'
                  : 'Todos os dias, somente no ensaio.'}
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <FormField
                  label={`Horário: ${kind.label}`}
                  type="time"
                  required
                  value={rule.time}
                  onChange={(event) =>
                    changeRule(kind.id, { time: event.target.value })
                  }
                />
                {kind.frequency === 'weekly' && (
                  <SelectField
                    label={`Dia: ${kind.label}`}
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
            Respeitar período de silêncio na simulação
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
          <p className="mt-3 text-xs leading-5 text-soma-600">
            Pode atravessar a meia-noite, como 22h às 8h. No silêncio, o ensaio
            não exibe o aviso nem o transfere automaticamente para outro
            horário.
          </p>
        </Card>
        <Feedback error={error} message={message} />
        <PrimaryButton type="submit">Salvar simulação</PrimaryButton>
      </form>
      <button
        type="button"
        onClick={stop}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-soma-200 bg-white px-4 py-4 font-semibold text-soma-800"
      >
        <BellOff size={20} aria-hidden="true" />
        Desligar todos os lembretes
      </button>
      <Card className="mt-6">
        <h2 className="font-semibold">Testar um horário fictício</h2>
        <p className="mt-2 text-sm leading-6 text-soma-600">
          Este ensaio usa os ajustes da tela, mesmo antes de salvar. O horário é
          interpretado no fuso selecionado acima; não é o relógio real do
          aparelho.
        </p>
        <form onSubmit={testClock} className="mt-4 space-y-4">
          <SelectField
            label="Dia da semana para o teste"
            value={clock.weekday}
            onChange={(event) => {
              setClock((old) => ({
                ...old,
                weekday: Number(event.target.value),
              }))
              setSimulation(null)
            }}
          >
            {weekdays.map((day, index) => (
              <option key={day} value={index}>
                {day}
              </option>
            ))}
          </SelectField>
          <FormField
            label="Horário fictício para o teste"
            type="time"
            required
            value={clock.time}
            onChange={(event) => {
              setClock((old) => ({ ...old, time: event.target.value }))
              setSimulation(null)
            }}
          />
          <PrimaryButton type="submit" className="gap-2">
            <Bell size={18} aria-hidden="true" />
            Simular horário
          </PrimaryButton>
        </form>
        {simulation && (
          <div
            role="status"
            className="mt-4 rounded-2xl bg-soma-50 p-4 text-sm leading-6"
          >
            {simulation.status === 'disabled' && (
              <p>Simulação desligada. Nenhum aviso seria exibido.</p>
            )}
            {simulation.status === 'quiet' && (
              <p>
                Período de silêncio. Nenhum aviso seria exibido neste horário.
              </p>
            )}
            {simulation.status === 'empty' && (
              <p>Nenhum lembrete selecionado para este dia e horário.</p>
            )}
            {simulation.status === 'due' && (
              <>
                <p className="font-semibold">
                  Prévia visual · não é uma notificação real
                </p>
                <p className="mt-2 font-semibold">Endo +</p>
                <p>
                  Você tem um lembrete de rotina. Abra o aplicativo para
                  conferir.
                </p>
                <p className="mt-3 text-xs">
                  Itens deste ensaio: {simulation.labels.join(', ')}.
                </p>
              </>
            )}
          </div>
        )}
      </Card>
      <p className="mt-5 text-xs leading-5 text-soma-600">
        Lembretes não substituem orientação profissional nem garantem o horário
        de uma medicação. Não há envio automático, mesmo se esta tela ficar
        aberta ou o app for instalado. Sair da demonstração apaga estes ajustes
        fictícios.
      </p>
    </>
  )
}
