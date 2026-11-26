import { useEffect, useMemo, useState } from 'react'
import { FileText, HeartPulse, ShieldCheck, Upload, UserRound, Utensils } from 'lucide-react'
import AppHeader from '../components/AppHeader'
import MetabolicCard from '../components/MetabolicCard'
import { useAuth } from '../contexts/AuthContext'
import { cgmConsentVersion, defaultGlucoseTargets, localDayBoundary } from '../config/deviceImport'
import { RESEARCH_EXPORT_ENABLED } from '../config/phase10'
import { demoGlp1Course } from '../data/demoGlp1Course'
import { makeDemoGlucoseCsv } from '../data/demoGlucoseCsv'
import { agpByHour, calculateCgmMetrics, mergeGlucoseImports, parseLibreViewCsv } from '../lib/cgmImport'
import { calculateGlp1Metrics, confirmPatientSuspension, professionalAttentionSignals, reportPatientSuspension } from '../lib/glp1Treatment'
import { Feedback } from '../components/ui'

const TODAY = '2026-11-26'
const formatNumber = (value, digits = 1) =>
  Number.isFinite(value)
    ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(value)
    : '—'
const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`))
    : '—'

function dayKey(instant, timeZone) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(instant))
  } catch {
    return new Date(instant).toISOString().slice(0, 10)
  }
}

function shiftDay(value, days) {
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function courseMetrics() {
  const medicatedPhases = demoGlp1Course.phases
    .filter((phase) => ['titulação', 'manutenção', 'redução'].includes(phase.type))
    .map(({ start, end }) => ({ start, end }))
  return calculateGlp1Metrics({ ...demoGlp1Course, medicatedPhases, now: TODAY })
}

function LineChart({ points, label }) {
  if (!points.length) return <p className="text-sm text-soma-600">Ainda não há leituras para este período.</p>
  const values = points.map((item) => item.valueMgDl)
  const min = Math.min(50, ...values)
  const max = Math.max(250, ...values)
  const path = points
    .map((item, index) => {
      const x = (index / Math.max(1, points.length - 1)) * 320
      const y = 140 - ((item.valueMgDl - min) / (max - min || 1)) * 120
      return `${index ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
  const yFor = (value) => 140 - ((value - min) / (max - min || 1)) * 120
  return (
    <figure aria-label={label}>
      <svg className="h-40 w-full overflow-visible" viewBox="0 0 320 160" role="img" aria-label={label}>
        <rect x="0" y={yFor(180)} width="320" height={Math.max(1, yFor(70) - yFor(180))} rx="8" fill="#e8f2f8" />
        <line x1="0" x2="320" y1={yFor(70)} y2={yFor(70)} stroke="#b9cfdd" strokeDasharray="4 5" />
        <line x1="0" x2="320" y1={yFor(180)} y2={yFor(180)} stroke="#b9cfdd" strokeDasharray="4 5" />
        <path d={path} fill="none" stroke="#1c75bc" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <figcaption className="mt-2 text-xs text-soma-600">
        Faixa de referência exibida em tom neutro. Leituras importadas não são em tempo real.
      </figcaption>
    </figure>
  )
}

function WeightChart({ metrics }) {
  const rows = demoGlp1Course.weights
  const min = Math.min(...rows.map((row) => row.kg)) - 2
  const max = Math.max(...rows.map((row) => row.kg)) + 2
  const path = rows.map((row, index) => {
    const x = (index / Math.max(1, rows.length - 1)) * 320
    const y = 130 - ((row.kg - min) / (max - min)) * 100
    return `${index ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
  const nadirIndex = rows.findIndex((row) => row.date === metrics.nadir?.date)
  const nadirX = (nadirIndex / Math.max(1, rows.length - 1)) * 320
  const nadirY = 130 - ((metrics.nadir?.kg - min) / (max - min)) * 100
  return (
    <figure>
      <svg className="h-36 w-full" viewBox="0 0 320 145" role="img" aria-label="Linha do tempo fictícia do peso">
        <rect x="0" y="18" width="250" height="108" rx="8" fill="#e8f2f8" />
        <rect x="250" y="18" width="70" height="108" rx="8" fill="#f1f5f9" />
        <path d={path} fill="none" stroke="#1c75bc" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={nadirX} cy={nadirY} r="5" fill="#0b2d57" />
        <text x="8" y="140" fontSize="9" fill="#526476">tratamento</text>
        <text x="254" y="140" fontSize="9" fill="#526476">seguimento</text>
      </svg>
      <figcaption className="text-xs text-soma-600">Peso em registros fictícios; a linha não representa uma meta individual.</figcaption>
    </figure>
  )
}

function SummaryTile({ label, value, detail }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <p className="text-xs text-soma-600">{label}</p>
      <p className="mt-1 text-lg font-semibold text-soma-900">{value}</p>
      {detail && <p className="mt-1 text-xs text-soma-600">{detail}</p>}
    </div>
  )
}

function SectionTitle({ children }) {
  return <h2 className="mb-3 mt-7 text-lg font-semibold text-soma-900">{children}</h2>
}

export default function IntegrationsPreview() {
  const { isDemo } = useAuth()
  const [perspective, setPerspective] = useState('patient')
  const [sourceConsent, setSourceConsent] = useState(null)
  const [timezone, setTimezone] = useState('America/Sao_Paulo')
  const [expectedInterval, setExpectedInterval] = useState(15)
  const [imported, setImported] = useState(null)
  const [report, setReport] = useState(null)
  const [pdfFile, setPdfFile] = useState(null)
  const [pdfKind, setPdfKind] = useState('agp')
  const [professionalAccessLog, setProfessionalAccessLog] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [period, setPeriod] = useState('14')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [examReminders, setExamReminders] = useState(false)
  const [examDate, setExamDate] = useState('')
  const [referenceOverlay, setReferenceOverlay] = useState(false)

  const treatmentMetrics = useMemo(() => courseMetrics(), [])
  const phaseSignals = useMemo(() => professionalAttentionSignals({
    metrics: treatmentMetrics,
    pendingStop: report?.status === 'pending',
    lastWeightDate: demoGlp1Course.weights.at(-1).date,
    now: TODAY,
  }), [treatmentMetrics, report])
  const latestDay = imported?.readings.length
    ? dayKey(imported.readings.at(-1).occurredAt, imported.readings.at(-1).timeZone)
    : ''
  const endDay = period === 'custom' ? customEnd : latestDay
  const startDay = period === 'custom'
    ? customStart
    : endDay
      ? shiftDay(endDay, -(Number(period) - 1))
      : ''
  const glucoseMetrics = useMemo(() => {
    if (!imported || !startDay || !endDay) return null
    try {
      const start = localDayBoundary(startDay, imported.timeZone)
      const end = localDayBoundary(endDay, imported.timeZone, true)
      if (!Number.isFinite(start) || !Number.isFinite(end)) return null
      return calculateCgmMetrics(imported.readings, {
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        expectedIntervalMinutes: Number(expectedInterval),
        targets: defaultGlucoseTargets,
      })
    } catch {
      return null
    }
  }, [imported, startDay, endDay, expectedInterval])
  const visibleReadings = imported?.readings.filter((row) => {
    const day = dayKey(row.occurredAt, row.timeZone)
    return day >= startDay && day <= endDay
  }) ?? []
  const agp = useMemo(() => agpByHour(visibleReadings), [visibleReadings])
  const currentDayReadings = visibleReadings
    .filter((row) => dayKey(row.occurredAt, row.timeZone) === endDay)
  const currentWeekReadings = visibleReadings.filter((row) =>
    dayKey(row.occurredAt, row.timeZone) >= shiftDay(endDay || TODAY, -6),
  )

  function consentSource(allowed) {
    setError('')
    if (allowed) {
      setSourceConsent({ grantedAt: new Date().toISOString(), version: cgmConsentVersion })
      setNotice('Autorização fictícia registrada nesta aba. Nenhum dado foi enviado.')
      return
    }
    setSourceConsent(null)
    setImported(null)
    setPdfFile(null)
    setPdfKind('agp')
    setNotice('Na demonstração, a autorização foi revogada e os arquivos em memória foram apagados.')
  }

  function importText(text, filename) {
    setError('')
    setNotice('')
    try {
      if (!sourceConsent) throw new Error('Autorize primeiro esta fonte de dados para continuar na demonstração.')
      const parsed = parseLibreViewCsv(text, { timeZone: timezone.trim() })
      const next = mergeGlucoseImports(imported, { ...parsed, filename })
      setImported(next)
      setPeriod('14')
      setNotice(`${parsed.readings.length} novas leituras analisadas; ${next.readings.length} leituras únicas após deduplicação. Os arquivos foram analisados somente nesta aba.`)
    } catch (failure) {
      setError(failure.message || 'Não foi possível ler este arquivo.')
    }
  }

  async function chooseCsv(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 5_000_000) {
      setError('O arquivo precisa ter até 5 MB.')
      return
    }
    try {
      importText(await file.text(), file.name)
    } catch {
      setError('Não foi possível abrir esse arquivo CSV.')
    } finally {
      event.target.value = ''
    }
  }

  function choosePdf(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf') || file.size > 10_000_000) {
      setError('Selecione um arquivo PDF fictício de até 10 MB.')
      event.target.value = ''
      return
    }
    setError('')
    setPdfFile(file)
    event.target.value = ''
  }

  function loadSyntheticCsv() {
    const csv = makeDemoGlucoseCsv({ days: period === '90' ? 90 : 14, endDate: new Date(`${TODAY}T12:00:00-03:00`), timeZone: timezone })
    importText(csv, 'libreview-demo-ficticio.csv')
  }

  function reportStop() {
    try {
      setReport(reportPatientSuspension(report, {
        date: new Date().toISOString().slice(0, 10),
        reason: 'decisao_do_paciente',
      }))
    } catch (failure) {
      setError(failure.message)
      return
    }
    setNotice('Relato de teste anotado. Ele aguarda confirmação profissional e não iniciou um novo seguimento.')
  }

  const isProfessional = perspective === 'professional'
  const accessAllowed = Boolean(sourceConsent)

  useEffect(() => {
    if (isProfessional && accessAllowed && imported)
      setProfessionalAccessLog(new Date().toLocaleString('pt-BR'))
  }, [isProfessional, accessAllowed, imported])

  if (!isDemo) {
    return (
      <>
        <AppHeader title="Integrações e tratamento" subtitle="Prévia com dados fictícios" simple />
        <MetabolicCard><p>Esta área está disponível somente na demonstração sem cadastro. Nenhum dado real deve ser inserido.</p></MetabolicCard>
      </>
    )
  }

  return (
    <>
      <AppHeader title="Integrações e tratamento" subtitle="Prévia · nenhum dado enviado" simple />
      <div className="mb-5 rounded-2xl border border-soma-200 bg-soma-100 p-4 text-sm leading-6 text-soma-800">
        <strong>Demonstração isolada.</strong> Use somente dados fictícios. CSV e PDF ficam na memória desta aba; não há armazenamento, conexão com serviço ou alertas em tempo real.
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-2 shadow-card" aria-label="Perspectiva da demonstração">
        <button type="button" aria-pressed={!isProfessional} onClick={() => setPerspective('patient')} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold ${!isProfessional ? 'bg-soma-800 text-white' : 'text-soma-700'}`}>
          <UserRound size={17} /> Paciente
        </button>
        <button type="button" aria-pressed={isProfessional} onClick={() => setPerspective('professional')} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold ${isProfessional ? 'bg-soma-800 text-white' : 'text-soma-700'}`}>
          <HeartPulse size={17} /> Profissional
        </button>
      </div>
      <Feedback error={error} message={notice} />

      <SectionTitle>Tratamento com GLP-1</SectionTitle>
      {!isProfessional ? (
        <PatientTreatment metrics={treatmentMetrics} report={report} onReportStop={reportStop} />
      ) : (
        <ProfessionalTreatment metrics={treatmentMetrics} signals={phaseSignals} report={report} onConfirmStop={() => setReport((current) => confirmPatientSuspension(current, { professionalId: 'demo-professional-a' }))} examReminders={examReminders} setExamReminders={setExamReminders} examDate={examDate} setExamDate={setExamDate} referenceOverlay={referenceOverlay} setReferenceOverlay={setReferenceOverlay} />
      )}

      <SectionTitle>Glicose contínua e dispositivos</SectionTitle>
      {!isProfessional ? (
        <SourceConsentCard consent={sourceConsent} onChange={consentSource} />
      ) : (
        <MetabolicCard className="mb-4">
          <h3 className="font-semibold">Acesso a dados importados</h3>
          <p className="mt-2 text-sm leading-6 text-soma-600">
            {accessAllowed ? 'Consentimento fictício ativo para arquivos de glicose. O acesso demonstrado é somente leitura.' : 'O paciente ainda não autorizou esta fonte. Os dados e anexos não são exibidos.'}
          </p>
          {accessAllowed && <p className="mt-2 text-xs text-soma-600">Consentimento {sourceConsent.version} · {new Date(sourceConsent.grantedAt).toLocaleString('pt-BR')}</p>}
          {professionalAccessLog && <p className="mt-2 text-xs text-soma-600">Log fictício de acesso a esta tela: {professionalAccessLog}. Não é um log persistente do servidor.</p>}
        </MetabolicCard>
      )}

      {accessAllowed ? (
        <>
          {!isProfessional && (
            <MetabolicCard className="mb-4">
              <h3 className="flex items-center gap-2 font-semibold"><FileText size={18} /> Anexar relatório em PDF</h3>
              <p className="mt-2 text-sm leading-6 text-soma-600">O PDF do AGP ou da bomba fica apenas como anexo para a revisão profissional. Nenhum número ou dose é extraído; neste protótipo o arquivo fica só na memória da aba.</p>
              <label htmlFor="pdf-kind" className="mt-3 block text-sm font-medium">Tipo de relatório</label>
              <select id="pdf-kind" value={pdfKind} onChange={(event) => setPdfKind(event.target.value)} className="mt-1 w-full rounded-xl border border-soma-200 bg-white px-3 py-3 text-sm"><option value="agp">Relatório AGP de glicose</option><option value="pump">Relatório da bomba de insulina</option></select>
              <label htmlFor="patient-pdf" className="mt-3 block text-sm font-semibold">Selecionar PDF fictício</label>
              <input id="patient-pdf" type="file" accept="application/pdf,.pdf" disabled={!sourceConsent} onChange={choosePdf} className="mt-2 block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-soma-100 file:px-4 file:py-3 file:font-semibold" />
              {pdfFile && <p className="mt-2 break-all text-xs text-soma-600">Selecionado nesta sessão: {pdfFile.name}</p>}
            </MetabolicCard>
          )}
          <MetabolicCard className="mb-4">
            <h3 className="flex items-center gap-2 font-semibold"><Upload size={18} /> Arquivo de glicose (CSV)</h3>
            <p className="mt-2 text-sm leading-6 text-soma-600">O formato aceito nesta prévia é experimental. A compatibilidade com um CSV real do LibreView depende de conferirmos um arquivo anonimizado antes de liberar a função.</p>
            <label className="mt-4 block text-sm font-medium" htmlFor="cgm-timezone">Fuso horário informado</label>
            <input id="cgm-timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} className="mt-1 w-full rounded-xl border border-soma-200 bg-white px-3 py-3 text-sm" />
            <label className="mt-4 block text-sm font-medium" htmlFor="cgm-cadence">Intervalo esperado entre leituras automáticas</label>
            <select id="cgm-cadence" value={expectedInterval} onChange={(event) => setExpectedInterval(event.target.value)} className="mt-1 w-full rounded-xl border border-soma-200 bg-white px-3 py-3 text-sm">
              {[5, 15, 30, 60].map((value) => <option key={value} value={value}>{value} minutos</option>)}
            </select>
            <label className="mt-4 block text-sm font-semibold" htmlFor="cgm-file">Selecionar CSV fictício</label>
            <input id="cgm-file" type="file" accept=".csv,text/csv" disabled={!sourceConsent} onChange={chooseCsv} className="mt-2 block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-soma-100 file:px-4 file:py-3 file:font-semibold file:text-soma-800 disabled:opacity-50" />
            <button type="button" disabled={!sourceConsent} onClick={loadSyntheticCsv} className="mt-3 w-full rounded-xl bg-soma-800 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Carregar série fictícia de 14 dias</button>
            <a className="mt-3 inline-block py-2 text-sm font-semibold text-soma-700 underline" href="https://www.freestyle.abbott/en-us/support/faq/apps/downloading-glucose-data-from-the-freestyle-libre-3-app.html" target="_blank" rel="noreferrer">Abrir orientação oficial da Abbott sobre baixar os dados</a>
            <ol className="mt-3 space-y-2 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-soma-700">
              <li><strong>1.</strong> Entre em LibreView com a mesma conta usada no app FreeStyle Libre.</li>
              <li><strong>2.</strong> Abra “Glucose History” (Histórico de glicose).</li>
              <li><strong>3.</strong> Selecione “Download Glucose Data” e baixe o CSV. A versão e os cabeçalhos ainda serão validados com arquivo anonimizado.</li>
            </ol>
            {imported && <p className="mt-3 break-all text-xs text-soma-600">{imported.filename} · {imported.format} · fuso {imported.timeZone} · {imported.readings.length} leituras deduplicadas</p>}
          </MetabolicCard>
          {imported && <GlucoseReview imported={imported} metrics={glucoseMetrics} period={period} setPeriod={setPeriod} customStart={customStart} setCustomStart={setCustomStart} customEnd={customEnd} setCustomEnd={setCustomEnd} startDay={startDay} endDay={endDay} daily={currentDayReadings} weekly={currentWeekReadings} agp={agp} professional={isProfessional} pdfFile={pdfFile} setPdfFile={setPdfFile} />}
        </>
      ) : (
        <MetabolicCard className="mb-4"><p className="text-sm leading-6 text-soma-600">A fonte ainda não foi autorizada. O paciente decide separadamente se deseja compartilhar arquivos de glicose.</p></MetabolicCard>
      )}
      {isProfessional && accessAllowed && <ContextOverlay />}
      {isProfessional && accessAllowed && pdfFile && <MetabolicCard className="mb-4"><h3 className="flex items-center gap-2 font-semibold"><FileText size={18} /> {pdfKind === 'pump' ? 'Relatório de bomba anexado' : 'Relatório AGP anexado'}</h3><p className="mt-2 break-all text-sm">{pdfFile.name}</p><p className="mt-2 text-xs leading-5 text-soma-600">Anexo fictício visível nesta perspectiva. Não houve extração ou envio.</p></MetabolicCard>}
      {!isProfessional && sourceConsent && (
        <button type="button" onClick={() => consentSource(false)} className="mb-5 w-full rounded-xl border border-soma-200 bg-white px-4 py-3 text-sm font-semibold text-soma-800">Revogar autorização e apagar arquivos da demonstração</button>
      )}
      <p className="pb-4 text-xs leading-5 text-soma-600">Dados exibidos para revisão de interface e software. A prévia não acompanha urgências, não dá alarmes de glicose e não sugere doses ou condutas. Pesquisa e exportação de pesquisa permanecem desligadas ({String(RESEARCH_EXPORT_ENABLED)}).</p>
    </>
  )
}

function SourceConsentCard({ consent, onChange }) {
  return (
    <MetabolicCard className="mb-4">
      <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck size={18} /> Consentimento específico por fonte</h3>
      <p className="mt-2 text-sm leading-6 text-soma-600">“Glicose contínua — arquivos importados”. É separado de outros compartilhamentos e pode ser revogado. Nesta prévia, a autorização é somente demonstrativa e não substitui o fluxo seguro de uma conta real.</p>
      <label className="mt-4 flex items-start gap-3 text-sm leading-6">
        <input type="checkbox" checked={Boolean(consent)} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-5 w-5 accent-soma-700" />
        <span>Autorizo o uso dos arquivos de glicose nesta demonstração fictícia.</span>
      </label>
      {consent && <p className="mt-3 text-xs text-soma-600">Versão {consent.version} · registrado em {new Date(consent.grantedAt).toLocaleString('pt-BR')}.</p>}
    </MetabolicCard>
  )
}

function PatientTreatment({ metrics, report, onReportStop }) {
  return (
    <>
      <MetabolicCard className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs text-soma-600">Curso fictício · {demoGlp1Course.patientLabel}</p><h3 className="mt-1 font-semibold">Depois do tratamento</h3></div>
          <span className="rounded-full bg-soma-100 px-3 py-1 text-xs font-semibold text-soma-800">6 meses</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-soma-700">Recuperar parte do peso depois de parar o medicamento é comum e faz parte de como o corpo funciona. Continuar registrando ajuda sua equipe a decidir com você os próximos passos.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <SummaryTile label="Peso inicial" value={`${formatNumber(demoGlp1Course.initialWeight)} kg`} />
          <SummaryTile label="Peso mais recente" value={`${formatNumber(metrics.currentWeight)} kg`} />
          <SummaryTile label="Mudança desde o início" value={`${formatNumber(-metrics.totalLossPercent)}%`} detail="Registro fictício" />
          <SummaryTile label="Última pesagem" value={formatDate(demoGlp1Course.weights.at(-1).date)} />
        </div>
        <div className="mt-4"><WeightChart metrics={metrics} /></div>
        <p className="mt-4 text-xs leading-5 text-soma-600">A série é fictícia e não substitui uma avaliação individual.</p>
      </MetabolicCard>
      <MetabolicCard className="mb-4">
        <h3 className="font-semibold">Sua equipe continua junto</h3>
        <p className="mt-2 text-sm leading-6 text-soma-600">Pesagens a cada duas semanas nos primeiros três meses e depois mensalmente. Medidas de cintura e pressão: mensalmente. Lembretes de exames ficam desativados até uma data ser definida pelo profissional.</p>
        <div className="mt-4 rounded-xl bg-soma-50 p-3 text-xs leading-5 text-soma-700">A demonstração não envia notificações nem agenda consultas.</div>
      </MetabolicCard>
      <MetabolicCard className="mb-4">
        <h3 className="font-semibold">Fluxo de teste: informar suspensão</h3>
        <p className="mt-2 text-sm leading-6 text-soma-600">A ação abaixo cria uma pendência para confirmação profissional. Ela não inicia por conta própria um novo seguimento.</p>
        <button type="button" onClick={onReportStop} disabled={Boolean(report)} className="mt-4 w-full rounded-xl border border-soma-200 bg-white px-4 py-3 text-sm font-semibold text-soma-800 disabled:opacity-50">{report?.status === 'pending' ? 'Relato aguardando confirmação' : report?.status === 'confirmed' ? 'Relato confirmado no cenário' : 'Simular que parei de usar'}</button>
        {report?.status === 'pending' && <p className="mt-3 rounded-xl bg-soma-100 p-3 text-sm leading-5 text-soma-800">Converse com sua equipe antes de decidir parar ou mudar o tratamento. Quando o medicamento é suspenso, é comum recuperar parte do peso, e sua equipe pode planejar esse momento com você.</p>}
        {report?.status === 'confirmed' && <p className="mt-3 text-sm text-soma-700">Suspensão confirmada no cenário fictício; seguimento de 12 meses iniciado em {new Date(report.confirmedAt).toLocaleDateString('pt-BR')}.</p>}
      </MetabolicCard>
    </>
  )
}

function ProfessionalTreatment({ metrics, signals, report, onConfirmStop, examReminders, setExamReminders, examDate, setExamDate, referenceOverlay, setReferenceOverlay }) {
  return (
    <>
      <MetabolicCard className="mb-4">
        <h3 className="font-semibold">Curso fictício · {demoGlp1Course.medication}</h3>
        <p className="mt-1 text-xs text-soma-600">Início {formatDate(demoGlp1Course.startDate)} · suspensão {formatDate(demoGlp1Course.suspensionDate)} · última aplicação {formatDate(demoGlp1Course.lastApplication)}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <SummaryTile label="Perda até o menor peso" value={`${formatNumber(metrics.lossKg)} kg`} detail={`${formatNumber(metrics.lossPercent)}% do inicial`} />
          <SummaryTile label="Peso mais recente" value={`${formatNumber(metrics.currentWeight)} kg`} />
          <SummaryTile label="Parte da perda recuperada" value={`${formatNumber(metrics.recoveredPercent)}%`} detail={metrics.regainBand ?? 'Sem classificação'} />
          <SummaryTile label="Manteve ≥80% da perda" value={metrics.maintained80Percent === null ? 'Sem dado' : metrics.maintained80Percent ? 'Sim' : 'Não'} />
          <SummaryTile label="Resposta na semana 12" value={metrics.responseWeek12Percent === null ? 'Sem dado' : `${formatNumber(metrics.responseWeek12Percent)}%`} />
          <SummaryTile label="Resposta na semana 20" value={metrics.responseWeek20Percent === null ? 'Sem dado' : `${formatNumber(metrics.responseWeek20Percent)}%`} />
          <SummaryTile label="TR50 observado" value={metrics.tr50Months === null ? 'Ainda não observado' : `${formatNumber(metrics.tr50Months)} meses`} detail="Desde a suspensão registrada" />
          <SummaryTile label="Menor peso durante o tratamento" value={`${formatNumber(metrics.nadir?.kg)} kg`} detail={formatDate(metrics.nadir?.date)} />
        </div>
        <div className="mt-4"><WeightChart metrics={metrics} /></div>
        <p className="mt-3 text-xs leading-5 text-soma-600">Fases e doses são registros fictícios, não prescrições. Nenhum dado de pesquisa é exportado.</p>
        <div className="mt-4 rounded-xl bg-soma-50 p-3 text-xs leading-5 text-soma-700">Curso inferido de aplicações simuladas; fases e doses ainda requerem confirmação profissional. Alterações são registradas como eventos, sem sugerir esquema.</div>
        <h4 className="mt-4 text-sm font-semibold">Eventos de dose registrados (fictícios)</h4>
        <ul className="mt-2 space-y-2 text-xs text-soma-700">{demoGlp1Course.doseEvents.map((event) => <li key={event.date} className="rounded-lg bg-white p-3">{formatDate(event.date)} · {event.previousDoseMg == null ? 'início' : `${formatNumber(event.previousDoseMg)} mg`} → {formatNumber(event.newDoseMg)} mg · motivo: {event.reason}</li>)}</ul>
      </MetabolicCard>
      <MetabolicCard className="mb-4">
        <h3 className="font-semibold">Sinais de atenção · somente profissional</h3>
        <ul className="mt-3 space-y-2 text-sm leading-5 text-soma-700">
          {signals.map((signal) => <li key={signal} className="rounded-xl bg-soma-50 p-3">{signal}</li>)}
          {!signals.length && <li>Nenhum sinal calculado nesta demonstração.</li>}
        </ul>
        <p className="mt-3 text-xs leading-5 text-soma-600">Descrições para revisão profissional; não recomendam conduta. Os limites desta prévia (25%, 50%, 30 dias) aguardam definição clínica.</p>
      </MetabolicCard>
      <MetabolicCard className="mb-4">
        <h3 className="font-semibold">Suspensão e acompanhamento</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-soma-600">Motivo</dt><dd>custo</dd></div>
          <div><dt className="text-soma-600">Planejada</dt><dd>Não</dd></div>
          <div><dt className="text-soma-600">Redução gradual registrada</dt><dd>Sim</dd></div>
          <div><dt className="text-soma-600">Peso na suspensão</dt><dd>89,5 kg</dd></div>
        </dl>
        <p className="mt-3 text-xs leading-5 text-soma-600">A demonstração inclui o curso histórico e seis meses de registros posteriores. O fluxo pendente abaixo é um cenário de teste separado.</p>
        {report?.status === 'pending' ? (
          <div className="mt-4 rounded-xl border border-soma-200 p-3">
            <p className="text-sm font-semibold">Relato de suspensão aguardando confirmação</p>
            <p className="mt-1 text-xs">Este aviso só é exibido na perspectiva profissional.</p>
            <button type="button" onClick={onConfirmStop} className="mt-3 rounded-xl bg-soma-800 px-4 py-3 text-sm font-semibold text-white">Confirmar no cenário de demonstração</button>
            <p className="mt-2 text-xs text-soma-600">Confirmar cria o marco de seguimento de 12 meses; não sugere dose nem esquema de redução.</p>
          </div>
        ) : report?.status === 'confirmed' ? (
          <p className="mt-4 rounded-xl bg-soma-100 p-3 text-sm">Cenário de suspensão confirmado; acompanhamento de 12 meses iniciado.</p>
        ) : (
          <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-soma-600">Nenhum relato pendente no fluxo de teste.</p>
        )}
      </MetabolicCard>
      <MetabolicCard className="mb-4">
        <h3 className="font-semibold">Lembretes configuráveis · somente simulação</h3>
        <ul className="mt-3 space-y-2 text-sm text-soma-700">
          <li>Pesagem quinzenal nos primeiros 3 meses; depois mensal.</li>
          <li>Cintura e pressão arterial: mensal.</li>
        </ul>
        <label className="mt-4 flex gap-3 text-sm"><input type="checkbox" checked={examReminders} onChange={(event) => setExamReminders(event.target.checked)} /> Incluir lembrete de exames nesta simulação</label>
        {examReminders && <label className="mt-3 block text-sm">Data escolhida pelo profissional<input type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} className="mt-1 w-full rounded-xl border border-soma-200 px-3 py-3" /></label>}
        <p className="mt-3 text-xs text-soma-600">Nenhuma notificação será enviada.</p>
      </MetabolicCard>
      <MetabolicCard className="mb-4">
        <h3 className="font-semibold">Referência dos ensaios clínicos</h3>
        <label className="mt-3 flex gap-3 text-sm leading-6"><input type="checkbox" checked={referenceOverlay} onChange={(event) => setReferenceOverlay(event.target.checked)} disabled /> Exibir linhas de referência na revisão profissional</label>
        <p className="mt-2 text-xs leading-5 text-soma-600">Valores, citações e interpretação aguardam revisão do responsável clínico. As curvas permanecem indisponíveis até essa validação. Nada disso aparece ao paciente.</p>
      </MetabolicCard>
      <MetabolicCard className="mb-4">
        <h3 className="font-semibold">Pesquisa</h3>
        <p className="mt-2 text-sm leading-6 text-soma-600">Consentimento de pesquisa separado, desligado. Exportação de dados de pesquisa está tecnicamente bloqueada.</p>
        <button type="button" disabled className="mt-3 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-500">Pesquisa não disponível (RESEARCH_EXPORT_ENABLED=false)</button>
      </MetabolicCard>
    </>
  )
}

function GlucoseReview({ imported, metrics, period, setPeriod, customStart, setCustomStart, customEnd, setCustomEnd, startDay, endDay, daily, weekly, agp, professional, pdfFile, setPdfFile }) {
  return (
    <>
      <MetabolicCard className="mb-4">
        <h3 className="font-semibold">Período analisado</h3>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[['14', '14 dias'], ['90', '90 dias'], ['custom', 'Personalizado']].map(([value, label]) => <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)} className={`rounded-xl px-2 py-3 text-xs font-semibold ${period === value ? 'bg-soma-800 text-white' : 'bg-soma-100 text-soma-800'}`}>{label}</button>)}
        </div>
        {period === 'custom' && <div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs">Início<input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="mt-1 w-full rounded-xl border border-soma-200 px-2 py-3" /></label><label className="text-xs">Fim<input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="mt-1 w-full rounded-xl border border-soma-200 px-2 py-3" /></label></div>}
        <p className="mt-3 text-xs text-soma-600">{startDay || '—'} a {endDay || '—'} · unidade original preservada no parser; gráficos usam mg/dL.</p>
      </MetabolicCard>
      {metrics?.sufficient ? (
        <>
          {!professional ? (
            <>
              <MetabolicCard className="mb-4"><h3 className="font-semibold">Glicose no dia mais recente</h3><div className="mt-4"><LineChart points={daily.filter((row) => row.kind === 'automatic')} label="Leituras fictícias do dia" /></div></MetabolicCard>
              <MetabolicCard className="mb-4"><h3 className="font-semibold">Últimos 7 dias</h3><div className="mt-4"><LineChart points={weekly.filter((row) => row.kind === 'automatic').filter((_, index) => index % 8 === 0)} label="Leituras fictícias dos últimos sete dias" /></div></MetabolicCard>
              <div className="grid grid-cols-2 gap-3">
                <SummaryTile label="Média de glicose" value={`${formatNumber(metrics.meanMgDl)} mg/dL`} />
                <SummaryTile label="GMI estimado" value={`${formatNumber(metrics.gmi)}%`} />
                <SummaryTile label="Variação (CV)" value={`${formatNumber(metrics.coefficientOfVariation)}%`} />
                <SummaryTile label="Tempo na faixa configurada" value={`${formatNumber(metrics.timeInRange)}%`} />
              </div>
              <p className="mt-3 rounded-xl bg-soma-50 p-3 text-xs leading-5 text-soma-700">Estes dados vêm do arquivo que você importou e não são em tempo real. Para alertas de glicose, use o seu sensor ou a sua bomba.</p>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <SummaryTile label="Tempo de uso estimado" value={`${formatNumber(metrics.wearPercent)}%`} detail={`${metrics.readings} automáticas · ${imported.readings.filter((row) => row.kind === 'scanned').length} escaneadas no arquivo`} />
                <SummaryTile label="Média de glicose" value={`${formatNumber(metrics.meanMgDl)} mg/dL`} />
                <SummaryTile label="GMI" value={`${formatNumber(metrics.gmi)}%`} />
                <SummaryTile label="CV" value={`${formatNumber(metrics.coefficientOfVariation)}%`} />
                <SummaryTile label="70–180 mg/dL" value={`${formatNumber(metrics.timeInRange)}%`} />
                <SummaryTile label="Abaixo de 70 / de 54" value={`${formatNumber(metrics.belowRange)}% / ${formatNumber(metrics.below54)}%`} />
                <SummaryTile label="Acima de 180 / de 250" value={`${formatNumber(metrics.aboveRange)}% / ${formatNumber(metrics.above250)}%`} />
              </div>
              <MetabolicCard className="mt-4">
                <h3 className="font-semibold">Perfil glicêmico ambulatorial · 24 horas</h3>
                <p className="mt-1 text-xs text-soma-600">Percentis por hora local do paciente; registros sintéticos.</p>
                <div className="mt-3 max-h-80 overflow-auto">
                  <table className="w-full text-left text-xs"><thead className="sticky top-0 bg-white"><tr>{['Hora', 'P5', 'P25', 'Mediana', 'P75', 'P95'].map((heading) => <th key={heading} className="px-1 py-2">{heading}</th>)}</tr></thead><tbody>{agp.map((row) => <tr key={row.hour} className="border-t border-soma-100"><td className="px-1 py-2">{String(row.hour).padStart(2, '0')}h</td>{[row.p5, row.p25, row.median, row.p75, row.p95].map((value, index) => <td key={index} className="px-1 py-2">{value ?? '—'}</td>)}</tr>)}</tbody></table>
                </div>
              </MetabolicCard>
            </>
          )}
        </>
      ) : metrics ? (
        <MetabolicCard className="mb-4"><h3 className="font-semibold">Dados insuficientes para resumir este período</h3><p className="mt-2 text-sm leading-6 text-soma-600">O intervalo esperado foi atingido em {formatNumber(metrics.wearPercent)}%. As métricas resumidas ficam ocultas abaixo de 70% de uso estimado.</p></MetabolicCard>
      ) : (
        <MetabolicCard className="mb-4"><p className="text-sm text-soma-600">Selecione datas válidas e importe um arquivo para visualizar as leituras.</p></MetabolicCard>
      )}
    </>
  )
}

function ContextOverlay() {
  return (
    <MetabolicCard className="mb-4">
      <h3 className="flex items-center gap-2 font-semibold"><Utensils size={18} /> Contexto para conversa clínica</h3>
      <p className="mt-2 text-sm leading-6 text-soma-600">Sobreposição apenas demonstrativa. Refeição (diário alimentar, 12:30), registro de aplicação GLP-1 (09:00), pesagem (07:15) e sintoma informado (náusea leve) são eventos fictícios.</p>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{['Refeição · 12:30', 'Aplicação · 09:00', 'Peso · 07:15', 'Sintoma · informado'].map((item) => <span key={item} className="whitespace-nowrap rounded-full bg-soma-100 px-3 py-2 text-xs text-soma-800">{item}</span>)}</div>
    </MetabolicCard>
  )
}

