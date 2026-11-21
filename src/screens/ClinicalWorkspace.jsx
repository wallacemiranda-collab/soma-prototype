import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useDoctor } from '../components/DoctorShell'
import { clinicalIntegrationEnabled } from '../config/clinicalPreview'
import { clinicalRepository } from '../services/clinicalService'
import { sharingRepository } from '../services/sharingService'
import { clinicalModules, clinicalRecordTypes } from '../lib/clinicalModules'
import { professionalIdentity } from '../lib/sharing'
import {
  ClinicalHistory,
  ClinicalRecordForm,
} from '../components/ClinicalRecords'
import { ApplicationOverview, GlucoseOverview } from './ClinicalPreview'
import MetabolicCard from '../components/MetabolicCard'
import {
  Feedback,
  FormField,
  PrimaryButton,
  SelectField,
} from '../components/ui'

const activeShare = (row) =>
  !row.revoked_at &&
  (!row.expires_at || Date.parse(row.expires_at) > Date.now())
const configOf = (version) =>
  version?.module_key === 'diabetes'
    ? { low: version.glucose_low, high: version.glucose_high }
    : version?.module_key === 'glp1'
      ? {
          medication: version.medication,
          dose_mg: version.dose_mg,
          interval_days: version.interval_days,
          anchor_date: version.anchor_date,
        }
      : {}
function historyOf(data) {
  return data.records.map((row) => {
    if (row.kind !== 'injection') return row
    const v = data.versions.find(
      (version) => version.id === row.module_version_id,
    )
    return {
      ...row,
      plan_revision: v?.revision,
      plan_snapshot: v ? configOf(v) : null,
    }
  })
}
function useWorkspace(patientId) {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const reload = useCallback(async () => {
    const request = ++generation.current
    setLoading(true)
    setError('')
    try {
      const [next, list] = await Promise.all([
        patientId
          ? clinicalRepository.loadPatient(patientId)
          : clinicalRepository.loadMine(),
        patientId ? Promise.resolve([]) : sharingRepository.listDoctors(),
      ])
      if (request === generation.current) {
        setData(next)
        setProviders(list)
      }
    } catch {
      if (request === generation.current) {
        setData(null)
        setProviders([])
        setError(
          'Não foi possível confirmar os acompanhamentos ou sua autorização. Seus dados não foram substituídos por uma demonstração.',
        )
      }
    } finally {
      if (request === generation.current) setLoading(false)
    }
  }, [patientId, user.id])
  useEffect(() => {
    reload()
    let checking = false
    async function checkAccess() {
      if (checking) return
      checking = true
      const request = generation.current
      try {
        // A minimal server check avoids reloading the user's unfinished form.
        const allowed = patientId
          ? await sharingRepository.canRead(patientId)
          : true
        if (!allowed && request === generation.current) {
          generation.current++
          setLoading(false)
          setData(null)
          setError('Acesso encerrado ou revogado pelo paciente.')
        }
      } catch {
        if (request === generation.current) {
          generation.current++
          setLoading(false)
          setData(null)
          setError(
            'Não foi possível confirmar o acesso. Atualize para continuar.',
          )
        }
      } finally {
        checking = false
      }
    }
    const interval = setInterval(checkAccess, 30000)
    window.addEventListener('focus', checkAccess)
    return () => {
      generation.current++
      clearInterval(interval)
      window.removeEventListener('focus', checkAccess)
    }
  }, [reload, patientId])
  return { data, providers, loading, error, reload }
}
function Gate({ children }) {
  const { isDemo } = useAuth()
  if (!clinicalIntegrationEnabled || isDemo)
    return (
      <>
        <h1 className="text-2xl font-semibold">Integração em preparação</h1>
        <p className="mt-3">
          Os acompanhamentos de contas reais ainda não foram liberados.
        </p>
        <Link to="/home" className="mt-4 block py-3 font-semibold">
          Voltar ao início
        </Link>
      </>
    )
  return children
}
function State({ workspace, children }) {
  return (
    <>
      <Feedback error={workspace.error} />
      {workspace.loading && (
        <p role="status" className="py-4">
          Confirmando acompanhamentos...
        </p>
      )}
      {!workspace.data && !workspace.loading && (
        <button
          className="my-4 py-3 font-semibold text-soma-700"
          onClick={workspace.reload}
        >
          Tentar novamente
        </button>
      )}
      {workspace.data && children}
    </>
  )
}

export function ClinicalPatientWorkspace() {
  return (
    <Gate>
      <PatientContent />
    </Gate>
  )
}
export function ClinicalAccountEvolution() {
  const { isDemo } = useAuth()
  if (!clinicalIntegrationEnabled || isDemo) return null
  return <AccountEvolution />
}
function AccountEvolution() {
  const workspace = useWorkspace()
  return (
    <section className="mt-8" aria-label="Evolução clínica da conta">
      <h2 className="text-xl font-semibold">Acompanhamentos clínicos</h2>
      <Link
        to="/cuidados"
        className="my-3 block py-2 font-semibold text-soma-700"
      >
        Abrir meus acompanhamentos
      </Link>
      <State workspace={workspace}>
        {workspace.data && <ClinicalSummary data={workspace.data} />}
      </State>
    </section>
  )
}
function PatientContent() {
  const workspace = useWorkspace()
  const { data, providers, reload } = workspace
  const [selected, setSelected] = useState('glucose')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const busy = useRef(false)
  const requests = useRef(new Map())
  async function change(action) {
    if (busy.current) return
    busy.current = true
    setPending(true)
    setError('')
    try {
      await action()
      await reload()
    } catch (failure) {
      setError(
        failure.code === '40001'
          ? 'A autorização mudou. Atualize a página antes de tentar novamente.'
          : 'Não foi possível alterar a autorização. Confira a conexão e tente novamente.',
      )
    } finally {
      busy.current = false
      setPending(false)
    }
  }
  const active = data?.modules.filter((module) => module.active) ?? []
  const kinds = Object.entries(clinicalRecordTypes).filter(([, definition]) =>
    active.some((module) => module.module_key === definition.module),
  )
  const kind = kinds.some(([key]) => key === selected)
    ? selected
    : kinds[0]?.[0]
  const module = active.find(
    (value) => value.module_key === clinicalRecordTypes[kind]?.module,
  )
  return (
    <>
      <h1 className="text-2xl font-semibold">Meus acompanhamentos</h1>
      <p className="my-3 text-sm leading-6 text-soma-600">
        O médico ativa os módulos com sua autorização. Você registra suas
        observações; a equipe não é notificada em tempo real. Isto não é um
        canal de emergência.
      </p>
      <State workspace={workspace}>
        {data && (
          <>
            <section
              className="my-5 space-y-4"
              aria-label="Autorizar ativação clínica"
            >
              <h2 className="text-lg font-semibold">
                Autorizações de ativação
              </h2>
              <p className="text-sm">
                Permissão separada da leitura. Não permite editar suas
                anotações. Encerrar a leitura também encerra a ativação;
                renová-la não reativa módulos antigos.
              </p>
              {!providers.some(
                (provider) =>
                  activeShare(provider) &&
                  provider.profession === 'Medicina' &&
                  provider.council === 'CRM',
              ) && (
                <p className="text-sm">
                  Adicione e autorize seu médico em{' '}
                  <Link to="/compartilhar" className="underline">
                    Minha equipe de saúde
                  </Link>
                  .
                </p>
              )}
              {providers
                .filter(
                  (provider) =>
                    activeShare(provider) &&
                    provider.profession === 'Medicina' &&
                    provider.council === 'CRM',
                )
                .map((provider) => {
                  const allowed = data.permissions.some(
                    (permission) =>
                      permission.doctor_id === provider.doctor_id &&
                      permission.revoked_at === null,
                  )
                  return (
                    <ActivationConsent
                      key={`${provider.doctor_id}-${allowed}`}
                      provider={provider}
                      allowed={allowed}
                      pending={pending}
                      onChange={() =>
                        change(async () => {
                          if (allowed) {
                            await clinicalRepository.revokeActivation(
                              provider.doctor_id,
                            )
                            requests.current.delete(provider.doctor_id)
                          } else {
                            if (!requests.current.has(provider.doctor_id))
                              requests.current.set(
                                provider.doctor_id,
                                crypto.randomUUID(),
                              )
                            await clinicalRepository.grantActivation({
                              doctor_id: provider.doctor_id,
                              confirmed: true,
                              request_id: requests.current.get(
                                provider.doctor_id,
                              ),
                            })
                            requests.current.delete(provider.doctor_id)
                          }
                        })
                      }
                    />
                  )
                })}
              <Feedback error={error} />
            </section>
            {!!active.length && (
              <MetabolicCard className="my-5">
                <SelectField
                  label="O que deseja registrar no acompanhamento?"
                  value={kind}
                  disabled={workspace.loading}
                  onChange={(event) => setSelected(event.target.value)}
                >
                  {kinds.map(([key, definition]) => (
                    <option key={key} value={key}>
                      {definition.title}
                    </option>
                  ))}
                </SelectField>
                <div className="mt-5">
                  <ClinicalRecordForm
                    key={`${kind}-${module.current_version_id}`}
                    kind={kind}
                    plan={configOf(module.version)}
                    demo={false}
                    onSave={async (recordKind, values, requestId) => {
                      await clinicalRepository.saveRecord({
                        kind: recordKind,
                        values,
                        module_version_id: module.current_version_id,
                        request_id: requestId,
                      })
                      await reload()
                    }}
                  />
                </div>
              </MetabolicCard>
            )}
            {!active.length && (
              <p role="status" className="my-5 rounded-xl bg-white p-4 text-sm">
                Nenhum módulo clínico ativo. Seus registros anteriores continuam
                disponíveis.
              </p>
            )}
            {data.modules.map((value) => (
              <MetabolicCard key={value.id} className="my-4">
                <h2 className="font-semibold">
                  {
                    clinicalModules.find((m) => m.id === value.module_key)
                      ?.title
                  }
                </h2>
                <p className="my-2 text-sm">
                  {value.active ? 'Ativo' : 'Inativo'}
                </p>
                {value.enabled && (
                  <button
                    className="py-2 font-semibold text-soma-700"
                    disabled={pending}
                    onClick={() =>
                      change(() =>
                        clinicalRepository.closeModule({
                          module_key: value.module_key,
                          expected_version: value.current_version_id,
                        }),
                      )
                    }
                  >
                    Encerrar acompanhamento
                  </button>
                )}
              </MetabolicCard>
            ))}
            <ClinicalSummary data={data} />
          </>
        )}
      </State>
    </>
  )
}
function ActivationConsent({ provider, allowed, pending, onChange }) {
  const [confirmed, setConfirmed] = useState(false)
  return (
    <MetabolicCard>
      <h3 className="font-semibold">{provider.professional_name}</h3>
      <p className="mt-1 text-xs">{professionalIdentity(provider)}</p>
      <p className="mt-2 text-xs">
        Cadastro declarado: confirme o registro com o profissional.
      </p>
      {allowed ? (
        <button
          className="mt-3 py-2 font-semibold text-soma-700"
          disabled={pending}
          onClick={onChange}
        >
          Revogar ativação de {provider.professional_name}
        </button>
      ) : (
        <>
          <label className="my-4 flex items-start gap-3 text-sm">
            <input
              className="mt-1 h-5 w-5 shrink-0"
              type="checkbox"
              checked={confirmed}
              disabled={pending}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            Autorizo {provider.professional_name} a ativar e configurar meus
            acompanhamentos, sem editar meus registros.
          </label>
          <PrimaryButton disabled={pending || !confirmed} onClick={onChange}>
            Autorizar ativação de {provider.professional_name}
          </PrimaryButton>
        </>
      )}
    </MetabolicCard>
  )
}
function ClinicalSummary({ data }) {
  const records = historyOf(data)
  const diabetes = data.modules.find(
    (module) => module.module_key === 'diabetes',
  )
  const glp1 = data.modules.find(
    (module) => module.module_key === 'glp1' && module.active,
  )
  return (
    <section
      className="my-6 space-y-5"
      aria-label="Evolução dos acompanhamentos"
    >
      {diabetes?.version && (
        <GlucoseOverview
          records={records}
          config={configOf(diabetes.version)}
          demo={false}
        />
      )}
      {glp1?.version && (
        <ApplicationOverview
          records={records}
          plan={{
            revision: glp1.version.revision,
            config: configOf(glp1.version),
          }}
          demo={false}
        />
      )}
      <ClinicalHistory records={records} demo={false} />
    </section>
  )
}
export function ClinicalDoctorWorkspace() {
  return (
    <Gate>
      <DoctorContent />
    </Gate>
  )
}
function DoctorContent() {
  const { patientId } = useParams()
  const { user } = useAuth()
  const { profile } = useDoctor()
  const workspace = useWorkspace(patientId)
  const physician =
    profile?.profession === 'Medicina' && profile?.council === 'CRM'
  const permission = workspace.data?.permissions.some(
    (p) => p.doctor_id === user.id && p.revoked_at === null,
  )
  return (
    <>
      <Link
        to={`/profissional/pacientes/${patientId}`}
        className="mb-5 block py-3 font-semibold text-soma-700"
      >
        Voltar à evolução do paciente
      </Link>
      <h1 className="text-2xl font-semibold">Acompanhamentos autorizados</h1>
      <p className="my-3 text-sm">
        Os registros do paciente são somente leitura. Configurar módulos exige
        autorização separada e não equivale a uma prescrição emitida pelo app.
      </p>
      <State workspace={workspace}>
        {workspace.data && (
          <>
            {physician ? (
              <>
                <Feedback
                  message={
                    permission
                      ? 'Ativação autorizada pelo paciente.'
                      : 'O paciente ainda não autorizou a ativação de módulos.'
                  }
                />
                <div className="my-5 grid gap-4 md:grid-cols-2">
                  {clinicalModules.map((module) => {
                    const setting = workspace.data.modules.find(
                      (value) => value.module_key === module.id,
                    )
                    return (
                      <ModuleConfiguration
                        key={`${module.id}-${setting?.current_version_id ?? 'new'}`}
                        module={module}
                        setting={setting}
                        allowed={
                          permission &&
                          (!setting?.enabled || setting.doctor_id === user.id)
                        }
                        patientId={patientId}
                        onSaved={workspace.reload}
                      />
                    )
                  })}
                </div>
              </>
            ) : (
              <p className="my-4 text-sm">
                Sua autorização permite consulta do histórico. A configuração
                destes módulos é restrita a médicos com autorização específica
                do paciente.
              </p>
            )}
            <ClinicalSummary data={workspace.data} />
          </>
        )}
      </State>
    </>
  )
}
function ModuleConfiguration({ module, setting, allowed, patientId, onSaved }) {
  const [values, setValues] = useState(() => configOf(setting?.version))
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const busy = useRef(false)
  const request = useRef(crypto.randomUUID())
  const change = (key) => (event) => {
    setValues((current) => ({ ...current, [key]: event.target.value }))
    request.current = crypto.randomUUID()
  }
  return (
    <MetabolicCard>
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          if (busy.current) return
          busy.current = true
          setPending(true)
          setError('')
          try {
            await clinicalRepository.configure({
              patient_id: patientId,
              module_key: module.id,
              expected_version: setting?.current_version_id ?? null,
              request_id: request.current,
              config: values,
            })
            await onSaved()
          } catch (failure) {
            setError(
              failure.code === '40001'
                ? 'A configuração mudou. Atualize a página antes de continuar.'
                : 'Não foi possível configurar. Confira a autorização do paciente e os campos; seus valores foram preservados.',
            )
          } finally {
            busy.current = false
            setPending(false)
          }
        }}
        className="space-y-4"
      >
        <h2 className="text-lg font-semibold">{module.title}</h2>
        <p className="text-sm">{setting?.active ? 'Ativo' : 'Inativo'}</p>
        {!allowed && (
          <p className="text-xs text-soma-600">
            Sem autorização de configuração ou com outro médico responsável. O
            paciente controla a autorização e a troca.
          </p>
        )}
        <fieldset disabled={!allowed || pending} className="space-y-4">
          {module.id === 'diabetes' && (
            <>
              <FormField
                label="Limite inferior da glicemia (mg/dL)"
                type="number"
                min="10"
                max="1000"
                step="any"
                value={values.low ?? ''}
                onChange={change('low')}
              />
              <FormField
                label="Limite superior da glicemia (mg/dL)"
                type="number"
                min="10"
                max="1000"
                step="any"
                value={values.high ?? ''}
                onChange={change('high')}
              />
              <p className="text-xs">
                Faixa opcional. Preencha os dois limites ou deixe ambos vazios.
              </p>
            </>
          )}
          {module.id === 'glp1' && (
            <>
              <SelectField
                label="Medicamento informado"
                required
                value={values.medication ?? ''}
                onChange={change('medication')}
              >
                <option value="">Selecione</option>
                <option>Semaglutida</option>
                <option>Tirzepatida</option>
              </SelectField>
              <FormField
                label="Dose informada (mg)"
                required
                type="number"
                min="0.01"
                max="100"
                step="any"
                value={values.dose_mg ?? ''}
                onChange={change('dose_mg')}
              />
              <FormField
                label="Intervalo informado (dias)"
                required
                type="number"
                min="1"
                max="90"
                step="1"
                value={values.interval_days ?? ''}
                onChange={change('interval_days')}
              />
              <FormField
                label="Primeira aplicação prevista deste esquema"
                required
                type="date"
                value={values.anchor_date ?? ''}
                onChange={change('anchor_date')}
              />
              <p className="text-xs">
                Use o esquema já definido no atendimento. O app não sugere dose,
                frequência ou compensação de aplicações.
              </p>
            </>
          )}
          <PrimaryButton type="submit">
            {pending
              ? 'Salvando...'
              : setting
                ? `Atualizar ${module.title}`
                : `Ativar ${module.title}`}
          </PrimaryButton>
        </fieldset>
        <Feedback error={error} />
      </form>
    </MetabolicCard>
  )
}
