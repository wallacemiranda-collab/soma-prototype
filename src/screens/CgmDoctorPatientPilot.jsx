import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Activity } from 'lucide-react'
import { Card, Feedback } from '../components/ui'
import { LibreViewAgpReportCard } from '../components/LibreViewAgpReportCard'
import { useDoctor } from '../components/DoctorShell'
import { cgmPilotRepository } from '../services/cgmPilotService'

function displayDate(value, timeZone) {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: timeZone || 'America/Sao_Paulo',
    }).format(new Date(value))
  } catch {
    return new Date(value).toLocaleString('pt-BR')
  }
}

export default function CgmDoctorPatientPilot() {
  const { patientId } = useParams()
  const { profile } = useDoctor()
  const { state } = useLocation()
  const [readings, setReadings] = useState(null)
  const [pdfReports, setPdfReports] = useState(null)
  const [pdfError, setPdfError] = useState('')
  const [openingPdfId, setOpeningPdfId] = useState('')
  const [pdfUrls, setPdfUrls] = useState({})
  const [loadedPatientId, setLoadedPatientId] = useState(null)
  const [loadedDoctorId, setLoadedDoctorId] = useState(null)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const pdfUrlsRef = useRef({})

  useEffect(() => {
    let active = true
    setReadings(null)
    setPdfReports(null)
    setPdfError('')
    Object.values(pdfUrlsRef.current).forEach((url) => URL.revokeObjectURL(url))
    pdfUrlsRef.current = {}
    setPdfUrls({})
    setLoadedPatientId(null)
    setLoadedDoctorId(null)
    setError('')
    if (profile?.profession !== 'Medicina' || profile?.council !== 'CRM') {
      setError('Esta consulta está disponível somente para médicos com CRM.')
      return () => { active = false }
    }
    Promise.allSettled([
      cgmPilotRepository.loadDoctorPatient(patientId),
      cgmPilotRepository.loadDoctorPdfReports(patientId),
    ]).then(([csvResult, pdfResult]) => {
      if (!active) return
      const csvOk = csvResult.status === 'fulfilled'
      const pdfOk = pdfResult.status === 'fulfilled'
      setReadings(csvOk ? csvResult.value : [])
      setPdfReports(pdfOk ? pdfResult.value : [])
      if (!pdfOk) setPdfError('Relatórios PDF não estão disponíveis: confirme o compartilhamento, o módulo Diabetes e a autorização específica para PDF.')
      if (!csvOk && !pdfOk) setError('Não foi possível confirmar o compartilhamento, as autorizações e o módulo Diabetes. O acesso pode ter sido revogado ou expirado.')
      setLoadedPatientId(patientId)
      setLoadedDoctorId(profile.user_id)
    })
    return () => { active = false }
  }, [patientId, profile?.user_id, profile?.profession, profile?.council, reload])

  const patientName = state?.patientName || 'Paciente autorizado'
  const patientReadings =
    loadedPatientId === patientId && loadedDoctorId === profile?.user_id
      ? readings
      : null
  const latest = patientReadings?.slice(-50).reverse() ?? []
  const patientPdfReports = loadedPatientId === patientId && loadedDoctorId === profile?.user_id
    ? pdfReports
    : null

  async function openPdf(reportId) {
    setOpeningPdfId(reportId)
    setError('')
    try {
      const file = await cgmPilotRepository.downloadPdfReport(reportId)
      const previousUrl = pdfUrlsRef.current[reportId]
      if (previousUrl) URL.revokeObjectURL(previousUrl)
      const url = URL.createObjectURL(file)
      pdfUrlsRef.current = { ...pdfUrlsRef.current, [reportId]: url }
      setPdfUrls(pdfUrlsRef.current)
    } catch (failure) {
      setError(failure.message || 'Não foi possível abrir o PDF. A autorização pode ter sido revogada.')
    } finally {
      setOpeningPdfId('')
    }
  }

  useEffect(() => () => {
    Object.values(pdfUrlsRef.current).forEach((url) => URL.revokeObjectURL(url))
  }, [])

  return (
    <>
      <Link
        to={`/profissional/pacientes/${patientId}`}
        className="mb-5 inline-block py-2 text-sm font-semibold text-soma-700"
      >
        Voltar ao prontuário compartilhado
      </Link>
      <Card>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-soma-900">
          <Activity size={21} /> Dados de glicose importados
        </h1>
        <p className="mt-2 text-sm text-soma-700">{patientName}</p>
        <p className="mt-3 rounded-xl bg-soma-50 p-3 text-sm leading-6 text-soma-700">
          Somente leituras enviadas pelo paciente. A consulta exige compartilhamento ativo, autorização clínica e módulo Diabetes ativo. Estes dados não são tempo real e não geram alertas nem sugestões de conduta.
        </p>
      </Card>
      <Feedback error={error} />
      {error && (
        <button
          type="button"
          onClick={() => setReload((value) => value + 1)}
          className="mt-4 py-2 text-sm font-semibold text-soma-700"
        >
          Verificar autorização novamente
        </button>
      )}
      {patientReadings === null && !error ? <p role="status" className="mt-5">Confirmando autorização...</p> : null}
      {patientReadings && (
        <Card className="mt-5">
          <h2 className="font-semibold text-soma-900">Histórico autorizado</h2>
          <p className="mt-1 text-xs leading-5 text-soma-600">
            {patientReadings.length.toLocaleString('pt-BR')} leituras acessíveis nesta consulta. A tabela mostra até 50 mais recentes; sem interpretação clínica automática.
          </p>
          {latest.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-soma-100 text-xs text-soma-600">
                    <th className="py-2 pr-3 font-medium">Data e hora</th>
                    <th className="py-2 pr-3 font-medium">Glicose</th>
                    <th className="py-2 font-medium">Registro</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.map((row) => (
                    <tr key={row.id} className="border-b border-soma-50">
                      <td className="py-3 pr-3 text-soma-700">{displayDate(row.occurred_at, row.time_zone)}</td>
                      <td className="py-3 pr-3 font-semibold text-soma-900">{Number(row.glucose_mg_dl).toLocaleString('pt-BR')} mg/dL</td>
                      <td className="py-3 text-soma-700">{row.reading_type === 'automatic' ? 'Automático' : row.reading_type === 'scanned' ? 'Escaneado' : 'Não identificado'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-sm text-soma-600">O paciente ainda não importou leituras nesta autorização.</p>
          )}
        </Card>
      )}
      {patientPdfReports === null && !error ? <p role="status" className="mt-5">Confirmando acesso aos relatórios PDF...</p> : null}
      {patientPdfReports?.length > 0 && (
        <section className="mt-5" aria-label="Relatórios AGP do LibreView">
          <h2 className="text-lg font-semibold text-soma-900">Relatórios AGP do LibreView</h2>
          <p className="mt-1 text-sm leading-6 text-soma-700">Métricas extraídas do relatório. A abertura do PDF original é registrada e exige a autorização atual do paciente.</p>
          {patientPdfReports.map((report, index) => (
            <LibreViewAgpReportCard
              key={report.id}
              report={report}
              previousReport={report.parseStatus === 'recognized' ? patientPdfReports.slice(index + 1).find((item) => item.parseStatus === 'recognized') : null}
              previewUrl={pdfUrls[report.id]}
              loading={openingPdfId === report.id}
              onOpen={() => openPdf(report.id)}
            />
          ))}
        </section>
      )}
      {pdfError && <p className="mt-4 rounded-xl bg-soma-50 p-3 text-sm leading-6 text-soma-700">{pdfError}</p>}
    </>
  )
}
