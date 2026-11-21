import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import MetabolicCard from '../components/MetabolicCard'
import {
  ClinicalHistory,
  ClinicalRecordForm,
} from '../components/ClinicalRecords'
import {
  Feedback,
  FormField,
  PrimaryButton,
  SelectField,
} from '../components/ui'
import { useClinicalPreview } from '../contexts/ClinicalPreviewContext'
import {
  clinicalModules,
  clinicalRecordTypes,
  glucoseContexts,
  injectionSites,
  measurementsInRange,
  nextApplication,
  previewDoctors,
} from '../lib/clinicalModules'
import { moduleIsActive } from '../lib/clinicalPreviewStore'
import { formatDate, formatNumber, localDate } from '../lib/patientData'

function PreviewGate({ children }) {
  const preview = useClinicalPreview()
  if (!preview?.enabled)
    return (
      <>
        <AppHeader title="Prévia indisponível" simple />
        <p>
          Os módulos desta etapa só podem ser abertos na prévia com dados
          fictícios.
        </p>
        <Link
          to="/home"
          className="mt-4 block py-3 font-semibold text-soma-700"
        >
          Voltar ao início
        </Link>
      </>
    )
  return (
    <>
      <div className="mb-5 rounded-xl border border-soma-200 bg-white p-4 text-sm">
        <strong>Prévia clínica · sem uso assistencial</strong>
        <p className="mt-2 text-xs leading-5">
          Atores, permissões e registros são fictícios. Não há conexão com
          contas ou pacientes reais. Esta tela não monitora urgências nem
          recomenda tratamento.
        </p>
      </div>
      {children}
    </>
  )
}

export function ClinicalHub() {
  const preview = useClinicalPreview()
  return <PreviewGate>{preview?.enabled && <HubContent />}</PreviewGate>
}
function HubContent() {
  const { data, grant, close } = useClinicalPreview()
  const active = clinicalModules.filter((module) =>
    moduleIsActive(data, module.id),
  )
  const archived = clinicalModules.filter(
    (module) => data.modules[module.id] && !moduleIsActive(data, module.id),
  )
  return (
    <>
      <AppHeader
        title="Meus módulos"
        subtitle="Acompanhamentos escolhidos com seu médico"
        simple
      />
      <section className="space-y-3" aria-label="Módulos ativos">
        {!active.length && (
          <MetabolicCard>
            <h2 className="font-semibold">Nenhum módulo ativo</h2>
            <p className="mt-2 text-sm text-soma-600">
              Na simulação, autorize um médico abaixo e visite a perspectiva
              médica para ativar um acompanhamento.
            </p>
          </MetabolicCard>
        )}
        {active.map((module) => (
          <MetabolicCard key={module.id}>
            <h2 className="font-semibold">{module.title}</h2>
            <p className="mt-2 text-sm text-soma-600">{module.description}</p>
            <p className="mt-2 text-xs">
              Responsável:{' '}
              {
                previewDoctors.find(
                  (doctor) => doctor.id === data.modules[module.id].doctorId,
                ).name
              }
            </p>
            <Link
              to={`/modulos/${module.id}`}
              className="mt-4 block py-2 font-semibold text-soma-700"
            >
              Abrir {module.title}
            </Link>
            <button
              type="button"
              onClick={() => close(module.id)}
              className="py-2 text-sm underline"
            >
              Encerrar módulo na simulação
            </button>
          </MetabolicCard>
        ))}
      </section>
      <section className="mt-6 space-y-3" aria-label="Autorização de ativação">
        <h2 className="text-lg font-semibold">Quem pode ativar módulos?</h2>
        <p className="text-sm leading-6 text-soma-600">
          O acesso de leitura da evolução é separado. Autorizar a ativação não
          permite editar suas anotações. Aqui, simulamos dois médicos que já
          receberam acesso de leitura.
        </p>
        {previewDoctors.map((doctor) => (
          <PermissionCard
            key={doctor.id}
            doctor={doctor}
            permission={data.permissions[doctor.id]}
            onChange={(allowed) => grant(doctor.id, allowed)}
          />
        ))}
      </section>
      <Link
        to="/previa/medico"
        className="mt-5 block rounded-2xl bg-soma-800 p-4 text-center font-semibold text-white"
      >
        Simular perspectiva do médico
      </Link>
      {!!archived.length && (
        <section className="mt-6 space-y-3">
          <h2 className="font-semibold">Acompanhamentos inativos</h2>
          {archived.map((module) => (
            <MetabolicCard key={module.id}>
              <h3 className="font-semibold">{module.title}</h3>
              <p className="mt-2 text-sm">
                Não aceita novos registros. A revogação ou o encerramento não
                apaga seu histórico.
              </p>
              <Link
                className="mt-3 block py-2 font-semibold text-soma-700"
                to={`/modulos/${module.id}`}
              >
                Ver histórico de {module.title}
              </Link>
              {data.modules[module.id].enabled && (
                <button
                  className="py-2 text-sm underline"
                  onClick={() => close(module.id)}
                >
                  Encerrar para permitir outro responsável
                </button>
              )}
            </MetabolicCard>
          ))}
        </section>
      )}
    </>
  )
}
function PermissionCard({ doctor, permission, onChange }) {
  const [confirmed, setConfirmed] = useState(false)
  return (
    <MetabolicCard>
      <h3 className="font-semibold">{doctor.name}</h3>
      <p className="mt-2 text-sm text-soma-600">
        Ativação:{' '}
        {permission.allowed ? 'autorizada na simulação' : 'não autorizada'}
      </p>
      {permission.allowed ? (
        <button
          type="button"
          className="mt-3 py-2 font-semibold text-soma-700"
          onClick={() => {
            onChange(false)
            setConfirmed(false)
          }}
        >
          Revogar ativação de {doctor.name}
        </button>
      ) : (
        <>
          <label className="mt-3 flex items-start gap-3 text-sm">
            <input
              className="mt-1 h-5 w-5 shrink-0"
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            Autorizo {doctor.name} a ativar e configurar módulos fictícios, sem
            editar meus registros.
          </label>
          <PrimaryButton
            className="mt-4"
            type="button"
            disabled={!confirmed}
            onClick={() => {
              onChange(true)
              setConfirmed(false)
            }}
          >
            Autorizar ativação de {doctor.name}
          </PrimaryButton>
        </>
      )}
    </MetabolicCard>
  )
}

export function ClinicalDoctorPreview() {
  const preview = useClinicalPreview()
  return <PreviewGate>{preview?.enabled && <DoctorContent />}</PreviewGate>
}
function DoctorContent() {
  const { data } = useClinicalPreview()
  const [doctorId, setDoctorId] = useState(previewDoctors[0].id)
  return (
    <>
      <Link
        to="/modulos"
        className="mb-5 block py-2 font-semibold text-soma-700"
      >
        Voltar à perspectiva do paciente
      </Link>
      <AppHeader
        title="Médico · simulação"
        subtitle="Paciente fictício, sem acesso a contas reais"
        simple
      />
      <SelectField
        label="Médico fictício em simulação"
        value={doctorId}
        onChange={(event) => setDoctorId(event.target.value)}
      >
        {previewDoctors.map((doctor) => (
          <option key={doctor.id} value={doctor.id}>
            {doctor.name}
          </option>
        ))}
      </SelectField>
      <p className="my-4 text-sm text-soma-600">
        Esta troca é apenas uma ferramenta de revisão da prévia, não um login
        profissional. Cadastros profissionais no produto atual são declarados,
        não verificados automaticamente.
      </p>
      {!data.permissions[doctorId].allowed && (
        <Feedback error="O paciente ainda não autorizou este médico a ativar módulos. A leitura fictícia abaixo não concede essa permissão." />
      )}
      <div className="mt-5 space-y-4">
        {clinicalModules.map((module) => (
          <DoctorModule
            key={`${module.id}-${doctorId}-${data.modules[module.id]?.revision ?? 0}`}
            module={module}
            doctorId={doctorId}
          />
        ))}
      </div>
      <div className="mt-8">
        {data.modules.diabetes && (
          <GlucoseOverview
            records={data.records}
            config={data.modules.diabetes.config}
          />
        )}
        <ClinicalHistory records={data.records} />
      </div>
    </>
  )
}
export function ClinicalEvolution() {
  const preview = useClinicalPreview()
  if (!preview?.enabled || !preview.data.records.length) return null
  const { data } = preview
  return (
    <section className="mt-8" aria-label="Evolução clínica fictícia">
      <h2 className="mb-4 text-xl font-semibold">Módulos clínicos · prévia</h2>
      <p className="mb-4 text-xs text-soma-600">
        Histórico fictício completo, separado do filtro de medidas acima. Nenhum
        registro enviado ao serviço.
      </p>
      {data.modules.diabetes && (
        <GlucoseOverview
          records={data.records}
          config={data.modules.diabetes.config}
        />
      )}
      <ClinicalHistory records={data.records} />
      <Link
        to="/modulos"
        className="mt-4 block py-3 font-semibold text-soma-700"
      >
        Abrir meus módulos
      </Link>
    </section>
  )
}

function DoctorModule({ module, doctorId }) {
  const { data, configure } = useClinicalPreview()
  const setting = data.modules[module.id]
  const [values, setValues] = useState(setting?.config ?? {})
  const [error, setError] = useState('')
  const canConfigure =
    data.permissions[doctorId].allowed &&
    (!setting?.enabled || setting.doctorId === doctorId)
  const change = (key) => (event) =>
    setValues((current) => ({ ...current, [key]: event.target.value }))
  return (
    <MetabolicCard>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          setError('')
          try {
            configure(doctorId, module.id, values)
          } catch (failure) {
            setError(failure.message)
          }
        }}
      >
        <h2 className="text-lg font-semibold">{module.title}</h2>
        <p className="text-sm">
          {moduleIsActive(data, module.id) ? 'Ativo' : 'Inativo'}
          {setting &&
            ` · responsável: ${previewDoctors.find((doctor) => doctor.id === setting.doctorId).name}`}
        </p>
        {setting?.enabled && setting.doctorId !== doctorId && (
          <p className="text-sm">
            Somente o responsável pode configurar. O paciente pode encerrar o
            módulo antes de escolher outro médico.
          </p>
        )}
        <fieldset disabled={!canConfigure} className="space-y-4">
          {module.id === 'diabetes' && (
            <>
              <p className="text-xs text-soma-600">
                Faixa opcional definida pelo médico, em mg/dL. Sem faixa, não
                calculamos percentual.
              </p>
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
            </>
          )}
          {module.id === 'glp1' && (
            <>
              <SelectField
                label="Medicamento fictício"
                required
                value={values.medication ?? ''}
                onChange={change('medication')}
              >
                <option value="">Selecione</option>
                <option>Semaglutida</option>
                <option>Tirzepatida</option>
              </SelectField>
              <FormField
                label="Dose fictícia (mg)"
                type="number"
                required
                min="0.01"
                max="100"
                step="any"
                value={values.dose_mg ?? ''}
                onChange={change('dose_mg')}
              />
              <FormField
                label="Intervalo prescrito fictício (dias)"
                type="number"
                required
                min="1"
                max="90"
                step="1"
                value={values.interval_days ?? ''}
                onChange={change('interval_days')}
              />
              <FormField
                label="Primeira aplicação prevista deste esquema"
                type="date"
                required
                value={values.anchor_date ?? ''}
                onChange={change('anchor_date')}
              />
              <p className="text-xs leading-5 text-soma-600">
                Sem dose ou frequência sugeridas. Campos de exemplo para revisão
                clínica; não constituem prescrição. Cada alteração cria outra
                versão do esquema.
              </p>
            </>
          )}
          <PrimaryButton type="submit">
            {setting?.enabled && setting.doctorId === doctorId
              ? `Salvar configuração de ${module.title}`
              : `Ativar ${module.title}`}
          </PrimaryButton>
        </fieldset>
        <Feedback error={error} />
      </form>
    </MetabolicCard>
  )
}

export function ClinicalModuleScreen() {
  const { moduleId } = useParams()
  const preview = useClinicalPreview()
  const module = clinicalModules.find((value) => value.id === moduleId)
  return (
    <PreviewGate>
      {preview?.enabled &&
        (module ? (
          <ModuleContent key={moduleId} module={module} />
        ) : (
          <p>Módulo não encontrado.</p>
        ))}
    </PreviewGate>
  )
}
function ModuleContent({ module }) {
  const { data, save, examples } = useClinicalPreview()
  const kinds = Object.entries(clinicalRecordTypes).filter(
    ([, value]) => value.module === module.id,
  )
  const [kind, setKind] = useState(kinds[0][0])
  const [error, setError] = useState('')
  const active = moduleIsActive(data, module.id)
  const plan = data.modules[module.id]
  return (
    <>
      <Link
        to="/modulos"
        className="mb-5 block py-2 font-semibold text-soma-700"
      >
        Voltar aos meus módulos
      </Link>
      <AppHeader title={module.title} subtitle={module.description} simple />
      {!active ? (
        <p role="status" className="mb-5 rounded-xl bg-soma-100 p-4 text-sm">
          Módulo inativo. Novas anotações estão bloqueadas; o histórico continua
          disponível.
        </p>
      ) : (
        <>
          {module.id === 'diabetes' && (
            <GlucoseOverview records={data.records} config={plan.config} />
          )}
          {module.id === 'glp1' && (
            <ApplicationOverview records={data.records} plan={plan} />
          )}
          <MetabolicCard className="mb-5">
            {kinds.length > 1 && (
              <SelectField
                className="mb-5"
                label="O que deseja registrar?"
                value={kind}
                onChange={(event) => setKind(event.target.value)}
              >
                {kinds.map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.title}
                  </option>
                ))}
              </SelectField>
            )}
            <ClinicalRecordForm
              key={kind}
              kind={kind}
              onSave={save}
              plan={plan.config}
            />
          </MetabolicCard>
          <button
            type="button"
            onClick={() => {
              setError('')
              try {
                examples(module.id)
              } catch (failure) {
                setError(failure.message)
              }
            }}
            className="mb-5 w-full rounded-xl border border-soma-200 bg-white p-3 text-sm font-semibold text-soma-700"
          >
            Adicionar exemplos fictícios de {module.title}
          </button>
          <Feedback error={error} />
        </>
      )}
      <ClinicalHistory records={data.records} moduleId={module.id} />
      <p className="mt-5 text-xs leading-5 text-soma-600">
        Anotações informadas pelo paciente, sem diagnóstico automático. Este app
        não confirma que sua equipe leu os registros e não é um canal de
        emergência. Sintomas importantes precisam de avaliação,
        independentemente dos números anotados.
      </p>
    </>
  )
}
function GlucoseOverview({ records, config }) {
  const [context, setContext] = useState('all')
  const readings = records
    .filter(
      (row) =>
        row.kind === 'glucose' &&
        (context === 'all' || row.context === context),
    )
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
  const range = measurementsInRange(records, config, context)
  const min = Math.min(...readings.map((row) => row.value))
  const max = Math.max(...readings.map((row) => row.value))
  const first = readings.length
    ? new Date(readings[0].occurred_at).getTime()
    : 0
  const last = readings.length
    ? new Date(readings.at(-1).occurred_at).getTime()
    : 0
  return (
    <MetabolicCard className="mb-5 space-y-4">
      <h2 className="font-semibold">Glicemias por contexto</h2>
      <SelectField
        label="Filtrar contexto das glicemias"
        value={context}
        onChange={(event) => setContext(event.target.value)}
      >
        <option value="all">Todos os contextos</option>
        {glucoseContexts.map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </SelectField>
      {!readings.length ? (
        <p className="text-sm">Ainda não há glicemias para este contexto.</p>
      ) : (
        <>
          <svg
            viewBox="0 0 320 130"
            className="h-36 w-full text-soma-500"
            role="img"
            aria-label="Glicemias capilares pontuais; detalhes no histórico abaixo"
          >
            <line x1="35" x2="310" y1="108" y2="108" stroke="#cbd5e1" />
            <text x="0" y="15" fontSize="10" fill="#334155">
              {max}
            </text>
            <text x="0" y="105" fontSize="10" fill="#334155">
              {min}
            </text>
            {readings.map((row) => (
              <circle
                key={row.id}
                cx={
                  last === first
                    ? 170
                    : 40 +
                      ((new Date(row.occurred_at).getTime() - first) /
                        (last - first)) *
                        260
                }
                cy={
                  max === min
                    ? 58
                    : 100 - ((row.value - min) / (max - min)) * 85
                }
                r="5"
                fill="currentColor"
              >
                <title>
                  {row.value} mg/dL · {row.occurred_at} ·{' '}
                  {glucoseContexts.find(([key]) => key === row.context)[1]}
                </title>
              </circle>
            ))}
          </svg>
          <div className="flex justify-between text-xs text-soma-600">
            <span>{formatDate(readings[0].occurred_at.slice(0, 10))}</span>
            <span>{formatDate(readings.at(-1).occurred_at.slice(0, 10))}</span>
          </div>
        </>
      )}
      <p className="text-sm font-semibold">
        {range
          ? `${formatNumber(range.percent, '%')} das medições na faixa (${range.inside} de ${range.total})`
          : 'Percentual indisponível: informe uma faixa e registre glicemias.'}
      </p>
      {config.low != null && (
        <p className="text-xs">
          Faixa fictícia configurada pelo médico: {config.low}–{config.high}{' '}
          mg/dL. Aplicada ao filtro e ao histórico mostrado, sem reclassificar
          exames.
        </p>
      )}
      <p className="text-xs leading-5 text-soma-600">
        São medições pontuais, não tempo na faixa de sensor contínuo. Não
        estimamos as horas entre medições.{' '}
        <a
          className="underline"
          href="https://diabetesjournals.org/care/article/42/8/1593/36184/Clinical-Targets-for-Continuous-Glucose"
          target="_blank"
          rel="noopener noreferrer"
        >
          Referência: consenso de monitorização contínua.
        </a>
      </p>
    </MetabolicCard>
  )
}
function ApplicationOverview({ records, plan }) {
  const next = nextApplication(plan, records)
  const last = records
    .filter((row) => row.kind === 'injection')
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0]
  return (
    <MetabolicCard className="mb-5 space-y-3">
      <h2 className="font-semibold">Seu esquema fictício</h2>
      <p>
        {plan.config.medication} · {formatNumber(plan.config.dose_mg, ' mg')} ·
        intervalo de {plan.config.interval_days} dia(s)
      </p>
      <p className="font-semibold">
        Próxima aplicação prevista:{' '}
        {next
          ? new Intl.DateTimeFormat('pt-BR').format(
              new Date(`${next}T12:00:00`),
            )
          : 'Sem previsão'}
      </p>
      {next && next < localDate() && (
        <p className="text-sm">
          A previsão ficou no passado. Isso não é orientação para aplicar,
          compensar ou alterar a dose. Confira o esquema com sua equipe.
        </p>
      )}
      <p className="text-xs leading-5">
        A previsão usa o intervalo cadastrado e a última aplicação desta versão
        do esquema; se não houver, usa a primeira data prevista. Não gera
        lembretes nesta fase.
      </p>
      <p className="text-sm">
        {last
          ? `Última região registrada: ${injectionSites.find(([key]) => key === last.site)[1]}. `
          : ''}
        Lembrete de rodízio: confira os pontos já usados e siga a bula do seu
        medicamento e a orientação da sua equipe. O app não escolhe o ponto de
        aplicação.
      </p>
      <a
        className="block text-xs underline"
        target="_blank"
        rel="noopener noreferrer"
        href={
          plan.config.medication === 'Semaglutida'
            ? 'https://www.novonordisk.com.br/content/dam/nncorp/br/pt/pdfs/bulas/patient/Wegovy_Bula_Paciente.pdf'
            : 'https://www.lilly.com/br/medicamentos/disponiveis'
        }
      >
        Consultar a bula do fabricante:{' '}
        {plan.config.medication === 'Semaglutida' ? 'Wegovy' : 'Mounjaro'}.
      </a>
    </MetabolicCard>
  )
}
