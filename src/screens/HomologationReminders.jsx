import { Bell, BellOff, Save, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import { Card, Feedback, FormField, PrimaryButton, SelectField } from '../components/ui'
import {
  reminderPushPublicKey,
  remindersHomologationEnabled,
} from '../config/reminders.js'
import { useAuth } from '../contexts/AuthContext'
import { decodeVapidPublicKey } from '../lib/webPush.js'
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
  const [pushConsentAccepted, setPushConsentAccepted] = useState(false)
  const [pushSupported, setPushSupported] = useState(true)
  const [pushPermission, setPushPermission] = useState('default')
  const [pushActive, setPushActive] = useState(false)
  const [pushSubscription, setPushSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const nodes = [
      Object.assign(document.createElement('link'), {
        rel: 'manifest',
        href: '/reminders-manifest.webmanifest',
      }),
      Object.assign(document.createElement('link'), {
        rel: 'apple-touch-icon',
        href: '/icons/endo-preview-180.png',
      }),
      Object.assign(document.createElement('meta'), {
        name: 'theme-color',
        content: '#1c75bc',
      }),
      Object.assign(document.createElement('meta'), {
        name: 'apple-mobile-web-app-title',
        content: 'Endo+ Teste',
      }),
    ]
    document.head.append(...nodes)
    return () => nodes.forEach((node) => node.remove())
  }, [])

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

  useEffect(() => {
    let active = true
    const supported = Boolean(
      window.isSecureContext &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window,
    )
    setPushSupported(supported)
    if (!supported || !user?.id) return undefined
    setPushPermission(Notification.permission)
    async function inspectSubscription() {
      try {
        const registration = await navigator.serviceWorker.getRegistration('/')
        const subscription = await registration?.pushManager.getSubscription()
        if (!active || !subscription) return
        setPushSubscription(subscription)
        const linked = await reminderRepository.hasPushSubscription(
          user.id,
          subscription.endpoint,
        )
        if (active) setPushActive(linked)
      } catch {
        if (active) setPushActive(false)
      }
    }
    inspectSubscription()
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
      if (!result.value.enabled && pushSubscription) {
        await pushSubscription.unsubscribe()
        setPushSubscription(null)
        setPushActive(false)
      }
      setMessage('Preferências salvas na sua conta fictícia de homologação.')
    } catch (failure) {
      setError(failure.message || 'Não foi possível salvar os lembretes.')
    } finally {
      setPending(false)
    }
  }

  async function enablePush() {
    if (pending) return
    setPending(true)
    setError('')
    setMessage('')
    try {
      if (!pushConsentAccepted)
        throw new Error('Autorize as notificações neste aparelho para continuar.')
      if (!value.enabled || !hasActiveConsent)
        throw new Error('Salve primeiro uma agenda ativa com sua autorização.')
      if (!pushSupported)
        throw new Error('Este navegador não oferece notificações push compatíveis.')
      const permissionRequest = Notification.requestPermission()
      const permission = await permissionRequest
      setPushPermission(permission)
      if (permission !== 'granted')
        throw new Error(
          permission === 'denied'
            ? 'A permissão foi bloqueada no navegador. Reative-a nas configurações do site.'
            : 'A permissão de notificações não foi concedida.',
        )
      const registration = await navigator.serviceWorker.register(
        '/reminder-sw.js',
        { scope: '/', updateViaCache: 'none' },
      )
      await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription)
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidPublicKey(reminderPushPublicKey),
        })
      await reminderRepository.savePushSubscription(
        user.id,
        subscription.toJSON(),
        { consentAccepted: pushConsentAccepted },
      )
      setPushSubscription(subscription)
      setPushActive(true)
      setMessage(
        'Este aparelho está vinculado. Os próximos horários ativos poderão gerar um aviso genérico.',
      )
    } catch (failure) {
      setError(failure.message || 'Não foi possível ativar as notificações.')
    } finally {
      setPending(false)
    }
  }

  async function disablePush() {
    if (pending) return
    setPending(true)
    setError('')
    setMessage('')
    try {
      await reminderRepository.removePushSubscription(
        user.id,
        pushSubscription?.endpoint ?? null,
      )
      await pushSubscription?.unsubscribe()
      setPushSubscription(null)
      setPushActive(false)
      setPushConsentAccepted(false)
      setMessage('Notificações desativadas neste aparelho.')
    } catch {
      setError('Não foi possível desativar agora. Tente novamente.')
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
      await pushSubscription?.unsubscribe()
      setPushSubscription(null)
      setPushActive(false)
      setPushConsentAccepted(false)
      setMessage(
        'Autorização revogada; agenda, horários e vínculos de notificação foram apagados.',
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
        <p className="font-semibold">Homologação: somente contas fictícias</p>
        <p className="mt-1">
          Os horários ficam no Supabase de testes. Se você ativar abaixo, os
          avisos serão enviados somente para esta conta fictícia e terão texto
          genérico, sem mencionar saúde, medicamentos, peso ou tratamentos.
        </p>
      </div>

      <Card className="mb-4">
        <div className="flex items-start gap-3">
          <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-soma-700" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">Notificações neste aparelho</h2>
            <p className="mt-1 text-sm leading-6 text-soma-600">
              A autorização do navegador é separada da autorização para salvar
              sua agenda. Você pode desativar este aparelho sem apagar os outros.
            </p>
          </div>
        </div>
        <label className="mt-4 flex items-start gap-3 text-sm leading-6">
          <input
            type="checkbox"
            checked={pushConsentAccepted}
            onChange={(event) => setPushConsentAccepted(event.target.checked)}
            className="mt-1 h-5 w-5 shrink-0 accent-soma-800"
          />
          <span>
            Aceito receber neste aparelho avisos genéricos nos horários que
            configurei. Não serão incluídos detalhes de saúde na notificação.
          </span>
        </label>
        <p className="mt-3 text-xs leading-5 text-soma-600" role="status">
          {!pushSupported
            ? 'Notificações push não estão disponíveis neste navegador ou endereço.'
            : pushPermission === 'denied'
              ? 'A permissão está bloqueada nas configurações do navegador.'
              : pushActive
                ? 'Este aparelho está autorizado para a conta fictícia.'
                : value.enabled
                  ? 'A agenda está ativa; você ainda precisa autorizar este aparelho.'
                  : 'Salve uma agenda ativa antes de vincular este aparelho.'}
        </p>
        {pushActive ? (
          <button
            type="button"
            onClick={disablePush}
            disabled={pending}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-soma-200 bg-white px-4 py-4 font-semibold text-soma-800 disabled:opacity-50"
          >
            <BellOff size={18} aria-hidden="true" />
            {pending ? 'Desativando...' : 'Desativar neste aparelho'}
          </button>
        ) : (
          <PrimaryButton
            type="button"
            onClick={enablePush}
            disabled={pending || !pushSupported || !pushConsentAccepted || !value.enabled}
            className="mt-4 gap-2"
          >
            <Bell size={18} aria-hidden="true" />
            {pending ? 'Ativando...' : 'Autorizar notificações neste aparelho'}
          </PrimaryButton>
        )}
        <p className="mt-3 text-xs leading-5 text-soma-600">
          No iPhone, notificações web podem exigir que o Endo + esteja instalado
          na Tela de Início. A permissão também pode ser alterada nas configurações do aparelho.
        </p>
      </Card>

      <Feedback error={error} message={message} />

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
        Os alertas dependem da conexão do navegador e do serviço push do sistema.
        Eles não substituem orientação profissional nem garantem entrega em todos
        os aparelhos. Use somente informações fictícias nesta homologação.
      </p>
    </>
  )
}
