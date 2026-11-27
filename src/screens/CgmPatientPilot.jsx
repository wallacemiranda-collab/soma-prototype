import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileUp, ShieldCheck, Trash2 } from 'lucide-react'
import AppHeader from '../components/AppHeader'
import { Card, Feedback, PrimaryButton } from '../components/ui'
import { LibreViewAgpReportCard, LibreViewReportPreview } from '../components/LibreViewAgpReportCard'
import { useAuth } from '../contexts/AuthContext'
import { createAccessRequestId } from '../lib/accessRequestId.js'
import { parseLibreViewCsv } from '../lib/cgmImport'
import { LIBREVIEW_PDF_MAX_BYTES } from '../lib/libreviewAgpPdfCore.js'
import { cgmPilotRepository } from '../services/cgmPilotService'

const SOURCE_TITLE = 'LibreView (CSV)'

function localDate(value, timeZone) {
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

export default function CgmPatientPilot() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [timeZone, setTimeZone] = useState('America/Sao_Paulo')
  const [pendingImport, setPendingImport] = useState(null)
  const [pendingPdf, setPendingPdf] = useState(null)
  const [consentChecked, setConsentChecked] = useState(false)
  const [pdfConsentChecked, setPdfConsentChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [openingPdfId, setOpeningPdfId] = useState('')
  const [pdfUrls, setPdfUrls] = useState({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const requestIds = useRef({})
  const pdfUrlsRef = useRef({})
  const accountIdRef = useRef(user?.id)
  accountIdRef.current = user?.id

  const reload = useCallback(async () => {
    if (!user?.id) {
      setData(null)
      return
    }
    const accountId = user.id
    setError('')
    try {
      const patientData = await cgmPilotRepository.loadPatient()
      setData({ ...patientData, accountId })
    } catch {
      setError('Não foi possível confirmar sua sessão ou carregar os dados. Tente atualizar a tela.')
    }
  }, [user?.id])

  useEffect(() => {
    setData(null)
    setPendingImport(null)
    setPendingPdf(null)
    setConsentChecked(false)
    setPdfConsentChecked(false)
    requestIds.current = {}
    Object.values(pdfUrlsRef.current).forEach((url) => URL.revokeObjectURL(url))
    pdfUrlsRef.current = {}
    setPdfUrls({})
    reload()
  }, [reload])

  useEffect(() => () => {
    Object.values(pdfUrlsRef.current).forEach((url) => URL.revokeObjectURL(url))
  }, [])

  const accountData = data?.accountId === user?.id ? data : null
  const consentActive = Boolean(accountData?.consent && !accountData.consent.revoked_at)
  const pdfConsentActive = Boolean(accountData?.pdfConsent && !accountData.pdfConsent.revoked_at)
  const recentReadings = useMemo(() => accountData?.readings.slice(-40).reverse() ?? [], [accountData])
  const latestImport = accountData?.imports?.[0]
  const reports = accountData?.pdfReports ?? []

  function requestIdFor(action) {
    requestIds.current[action] ??= createAccessRequestId()
    return requestIds.current[action]
  }

  async function runAction(action, successMessage, requestKey) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await action()
      if (requestKey) delete requestIds.current[requestKey]
      if (requestKey === 'grant' || requestKey === 'revoke') setConsentChecked(false)
      if (requestKey === 'grantPdf' || requestKey === 'revokePdf') setPdfConsentChecked(false)
      if (requestKey === 'savePdf') setPendingPdf(null)
      await reload()
      setPendingImport(null)
      setNotice(typeof successMessage === 'function' ? successMessage(result) : successMessage)
    } catch (failure) {
      setError(failure.message || 'Não foi possível concluir esta operação.')
    } finally {
      setBusy(false)
    }
  }

  async function choosePdf(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const accountId = accountIdRef.current
    setError('')
    setNotice('')
    setPendingPdf(null)
    try {
      if (file.size > LIBREVIEW_PDF_MAX_BYTES) throw new Error('O PDF precisa ter até 10 MB.')
      const { parseLibreViewAgpPdf } = await import('../lib/libreviewAgpPdf.js')
      const parsed = await parseLibreViewAgpPdf(file)
      if (!accountId || accountIdRef.current !== accountId) throw new Error('A conta mudou durante a leitura. Selecione o PDF novamente.')
      setPendingPdf({ file, parsed, accountId, reportId: createAccessRequestId(), requestId: createAccessRequestId() })
    } catch (failure) {
      setError(failure.message || 'Não foi possível analisar este PDF.')
    } finally {
      event.target.value = ''
    }
  }

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
      setError(failure.message || 'Não foi possível abrir o PDF.')
    } finally {
      setOpeningPdfId('')
    }
  }

  async function chooseCsv(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    setNotice('')
    setPendingImport(null)
    try {
      if (file.size > 5_000_000) throw new Error('O arquivo CSV precisa ter até 5 MB.')
      const parsed = parseLibreViewCsv(await file.text(), { timeZone: timeZone.trim() })
      if (parsed.format !== 'libreview-glucose-v1') {
        throw new Error('Este piloto ainda não aceita esta variação do CSV. Não envie o arquivo; peça revisão do formato primeiro.')
      }
      if (parsed.readings.length > 25000) throw new Error('O arquivo excede o limite de 25.000 leituras deste piloto.')
      setPendingImport({
        format: parsed.format,
        timeZone: parsed.timeZone,
        readings: parsed.readings,
        requestId: createAccessRequestId(),
      })
    } catch (failure) {
      setError(failure.message || 'Não foi possível analisar este CSV.')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <>
      <AppHeader title="Dados de glicose" subtitle="Prévia de piloto · homologação" simple />
      <div className="mb-5 rounded-2xl border border-soma-200 bg-soma-100 p-4 text-sm leading-6 text-soma-800">
        <strong>Ambiente de teste.</strong> Esta versão não monitora glicose em tempo real, não emite alarmes e não recomenda condutas. Não a use para decisões de tratamento ou situações urgentes.
      </div>
      <Feedback error={error} message={notice} />

      <Card className="mt-4">
        <h2 className="flex items-center gap-2 font-semibold text-soma-900"><ShieldCheck size={19} /> Relatórios LibreView em PDF</h2>
        <p className="mt-3 text-sm leading-6 text-soma-700">
          O Endo+ lê localmente o texto da primeira página, sem OCR ou IA externa. Antes de guardar, você confere o PDF original ao lado das métricas extraídas. Se o layout não for reconhecido, o sistema guarda somente o anexo e não tenta adivinhar valores.
        </p>
        <p className="mt-3 text-sm leading-6 text-soma-700">
          O PDF completo pode conter nome, data de nascimento, telefone e clínica. Com sua autorização, o arquivo fica em armazenamento privado, acessível a você e a um médico com CRM somente se o compartilhamento, a autorização clínica do módulo Diabetes e esta autorização específica de PDF estiverem ativos. Esses dados pessoais não são copiados para o registro de métricas.
        </p>
        <p className="mt-3 text-sm leading-6 text-soma-700">
          Você pode revogar a autorização para interromper novos acessos profissionais. Isso não apaga relatórios já guardados; a exclusão é uma ação separada. Cada consulta profissional ao arquivo é registrada.
        </p>
        <p className="mt-3 text-xs text-soma-600">Consentimento separado: endo-cgm-pdf-v1 · PDFs de até 10 MB</p>
        {pdfConsentActive ? (
          <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">Autorização para PDF ativa desde {localDate(accountData.pdfConsent.granted_at)}.</div>
        ) : (
          <>
            <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-soma-800">
              <input type="checkbox" checked={pdfConsentChecked} onChange={(event) => setPdfConsentChecked(event.target.checked)} className="mt-1 h-4 w-4 accent-soma-700" />
              <span>Li as informações e autorizo o armazenamento privado dos relatórios PDF do LibreView e das métricas extraídas, com acesso profissional somente nas condições descritas.</span>
            </label>
            <PrimaryButton
              className="mt-4"
              disabled={!pdfConsentChecked || busy}
              onClick={() => runAction(
                () => cgmPilotRepository.grantConsent(requestIdFor('grantPdf'), 'libreview_pdf'),
                'Autorização específica para PDF registrada.',
                'grantPdf',
              )}
            >
              Autorizar relatórios em PDF
            </PrimaryButton>
          </>
        )}
        {pdfConsentActive && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const confirmed = window.confirm('Revogar a autorização para PDF? O acesso profissional será bloqueado, mas os arquivos permanecerão privados até você excluí-los.')
              if (confirmed) runAction(
                () => cgmPilotRepository.revokeConsent(requestIdFor('revokePdf'), 'libreview_pdf'),
                'Autorização para PDF revogada. Os relatórios continuam privados na sua conta.',
                'revokePdf',
              )
            }}
            className="mt-4 w-full rounded-xl border border-soma-200 px-4 py-3 text-sm font-semibold text-soma-800 disabled:opacity-50"
          >
            Revogar autorização para PDF
          </button>
        )}
      </Card>

      {pdfConsentActive && (
        <Card className="mt-4">
          <h2 className="flex items-center gap-2 font-semibold text-soma-900"><FileUp size={19} /> Importar relatório PDF</h2>
          <p className="mt-2 text-sm leading-6 text-soma-700">Selecione um relatório AGP do LibreView em português ou inglês. O fluxo PDF mostra os resumos, mas não contém leituras individuais para desenhar uma curva.</p>
          <label htmlFor="cgm-libre-pdf" className="mt-4 block text-sm font-semibold text-soma-800">Relatório LibreView em PDF (até 10 MB)</label>
          <input id="cgm-libre-pdf" type="file" accept=".pdf,application/pdf" disabled={busy} onChange={choosePdf} className="mt-2 block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-soma-100 file:px-4 file:py-3 file:font-semibold file:text-soma-800 disabled:opacity-50" />
          {pendingPdf && (
            <div className="mt-5 space-y-4">
              <LibreViewReportPreview file={pendingPdf.file} parsed={pendingPdf.parsed} />
              <PrimaryButton
                disabled={busy}
                onClick={() => runAction(
                  () => cgmPilotRepository.savePdfReport(pendingPdf),
                  pendingPdf.parsed.status === 'recognized'
                    ? 'Relatório guardado. Os valores estão identificados como extraídos do relatório.'
                    : 'O anexo privado foi guardado sem métricas porque o formato não foi reconhecido.',
                  'savePdf',
                )}
              >
                Guardar relatório conferido
              </PrimaryButton>
            </div>
          )}
          <p className="mt-3 text-xs leading-5 text-soma-600">O arquivo só é enviado depois da confirmação. Nenhum PDF real de paciente é incluído no código do app.</p>
        </Card>
      )}

      {reports.map((report, index) => (
        <LibreViewAgpReportCard
          key={report.id}
          report={report}
          previousReport={report.parseStatus === 'recognized' ? reports.slice(index + 1).find((item) => item.parseStatus === 'recognized') : null}
          previewUrl={pdfUrls[report.id]}
          loading={openingPdfId === report.id}
          onOpen={() => openPdf(report.id)}
        />
      ))}

      {(pdfConsentActive || reports.length > 0) && (
        <Card className="mt-4">
          <h2 className="font-semibold text-soma-900">Privacidade dos relatórios PDF</h2>
          <p className="mt-2 text-sm leading-6 text-soma-700">A exclusão remove relatórios e métricas da conta; o registro de exclusão permanece no histórico de autorização. Também são limpos anexos PDF incompletos da área privada.</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const confirmed = window.confirm('Excluir todos os relatórios PDF e métricas LibreView desta conta? O registro da exclusão permanecerá no histórico de autorização.')
              if (confirmed) runAction(
                () => cgmPilotRepository.deletePdfReports(requestIdFor('deletePdf')),
                (result) => `${Number(result.deleted ?? 0).toLocaleString('pt-BR')} relatório(s) excluído(s).`,
                'deletePdf',
              )
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-700 disabled:opacity-50"
          >
            <Trash2 size={17} /> Excluir relatórios PDF guardados
          </button>
        </Card>
      )}

      <details className="mt-5">
        <summary className="cursor-pointer rounded-2xl border border-soma-200 bg-white p-5 font-semibold text-soma-900 shadow-card">Série detalhada (opcional) · Importar CSV</summary>
        <div className="mt-4">
      <Card>
        <h2 className="flex items-center gap-2 font-semibold text-soma-900"><ShieldCheck size={19} /> Autorização para importar {SOURCE_TITLE}</h2>
        <p className="mt-3 text-sm leading-6 text-soma-700">
          Se você autorizar, o Endo+ guardará somente as leituras normalizadas do CSV na sua conta, para você consultar. O arquivo original não será guardado. Um médico só poderá consultar esses dados se você também compartilhar sua conta com ele e autorizar o módulo Diabetes. Nutricionistas e outros profissionais não recebem acesso a esta tela.
        </p>
        <p className="mt-3 text-sm leading-6 text-soma-700">
          Você pode revogar a autorização a qualquer momento. A revogação interrompe novas importações e o acesso profissional; os dados já importados ficam visíveis somente para você até solicitar a exclusão. Se autorizar novamente, os dados antigos não voltam a ser compartilhados: será necessário importar o arquivo outra vez.
        </p>
        <p className="mt-3 text-xs text-soma-600">Versão do consentimento: endo-cgm-import-v1</p>
        {consentActive ? (
          <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
            Autorização ativa desde {localDate(accountData.consent.granted_at)}.
          </div>
        ) : (
          <>
            <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-soma-800">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(event) => setConsentChecked(event.target.checked)}
                className="mt-1 h-4 w-4 accent-soma-700"
              />
              <span>Li as informações acima e autorizo a importação das minhas leituras do LibreView para minha conta Endo+.</span>
            </label>
            <PrimaryButton
              className="mt-4"
              disabled={!consentChecked || busy}
              onClick={() => runAction(
                () => cgmPilotRepository.grantConsent(requestIdFor('grant')),
                'Autorização registrada. Ela pode ser revogada nesta tela.',
                'grant',
              )}
            >
              Autorizar importação
            </PrimaryButton>
          </>
        )}
        {consentActive && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const confirmed = window.confirm('Revogar agora? Profissionais perderão o acesso a partir desta confirmação. As leituras importadas continuarão visíveis somente para você até que sejam excluídas.')
              if (confirmed) runAction(
                () => cgmPilotRepository.revokeConsent(requestIdFor('revoke')),
                'Autorização revogada. Os dados existentes permanecem somente na sua conta.',
                'revoke',
              )
            }}
            className="mt-4 w-full rounded-xl border border-soma-200 px-4 py-3 text-sm font-semibold text-soma-800 disabled:opacity-50"
          >
            Revogar autorização
          </button>
        )}
      </Card>

      {consentActive && (
        <Card className="mt-4">
          <h2 className="flex items-center gap-2 font-semibold text-soma-900"><FileUp size={19} /> Importar CSV</h2>
          <p className="mt-2 text-sm leading-6 text-soma-700">
            Selecione a exportação de glicose do LibreView. O arquivo será lido no navegador e descartado após a importação; somente leituras compatíveis com o formato suportado serão enviadas.
          </p>
          <label htmlFor="cgm-pilot-timezone" className="mt-4 block text-sm font-medium text-soma-800">Fuso horário do aparelho</label>
          <input
            id="cgm-pilot-timezone"
            value={timeZone}
            onChange={(event) => setTimeZone(event.target.value)}
            className="mt-2 w-full rounded-xl border border-soma-200 bg-white px-4 py-3 text-sm"
          />
          <label htmlFor="cgm-pilot-file" className="mt-4 block text-sm font-semibold text-soma-800">Arquivo CSV do LibreView (até 5 MB)</label>
          <input
            id="cgm-pilot-file"
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={chooseCsv}
            className="mt-2 block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-soma-100 file:px-4 file:py-3 file:font-semibold file:text-soma-800 disabled:opacity-50"
          />
          {pendingImport && (
            <div className="mt-4 rounded-xl bg-soma-50 p-4 text-sm text-soma-800">
              <p>{pendingImport.readings.length.toLocaleString('pt-BR')} leituras reconhecidas. Nenhuma leitura foi enviada ainda.</p>
              <PrimaryButton
                className="mt-3"
                disabled={busy}
                onClick={() => runAction(
                  () => cgmPilotRepository.importReadings(pendingImport),
                  (result) => `Importação concluída: ${Number(result.inserted_rows).toLocaleString('pt-BR')} novas leituras; ${Number(result.duplicate_rows).toLocaleString('pt-BR')} duplicadas ignoradas.`,
                  'import',
                )}
              >
                Importar leituras
              </PrimaryButton>
            </div>
          )}
          <a
            className="mt-4 inline-block py-2 text-sm font-semibold text-soma-700 underline"
            href="https://www.freestyle.abbott/en-us/support/faq/apps/downloading-glucose-data-from-the-freestyle-libre-3-app.html"
            target="_blank"
            rel="noreferrer"
          >
            Orientação oficial da Abbott para exportar os dados
          </a>
        </Card>
      )}

      {!!accountData?.imports?.length && (
        <Card className="mt-4">
          <h2 className="font-semibold text-soma-900">Importações recentes</h2>
          <ul className="mt-3 space-y-3 text-sm text-soma-700">
            {accountData.imports.slice(0, 5).map((item) => (
              <li key={item.id} className="border-t border-soma-100 pt-3">
                <p>{localDate(item.imported_at)} · {item.parser_version}</p>
                <p className="mt-1 text-xs">{item.inserted_rows.toLocaleString('pt-BR')} novas · {item.duplicate_rows.toLocaleString('pt-BR')} duplicadas ignoradas</p>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const confirmed = window.confirm('Excluir todas as leituras e importações de LibreView guardadas na sua conta? O registro da exclusão permanecerá no histórico de autorização.')
              if (confirmed) runAction(
                () => cgmPilotRepository.deleteImportedData(),
                (result) => `${Number(result.deleted).toLocaleString('pt-BR')} leituras foram excluídas.`,
                'delete',
              )
            }}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-700 disabled:opacity-50"
          >
            <Trash2 size={17} /> Excluir dados importados
          </button>
        </Card>
      )}

      {!!recentReadings.length && (
        <Card className="mt-4">
          <h2 className="font-semibold text-soma-900">Leituras recentes</h2>
          <p className="mt-1 text-xs leading-5 text-soma-600">Dados importados sem interpretação, alarmes ou indicação de conduta.</p>
          <ul className="mt-3 divide-y divide-soma-100">
            {recentReadings.map((reading) => (
              <li key={reading.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <span className="text-soma-700">{localDate(reading.occurred_at, reading.time_zone)}</span>
                <span className="font-semibold text-soma-900">{Number(reading.glucose_mg_dl).toLocaleString('pt-BR')} mg/dL</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-soma-600">Mostrando até 40 leituras mais recentes.</p>
        </Card>
      )}
        </div>
      </details>

      {!!accountData?.events?.length && (
        <Card className="mt-4">
          <h2 className="font-semibold text-soma-900">Histórico de autorização e exclusões</h2>
          <ul className="mt-3 space-y-3 text-sm text-soma-700">
            {accountData.events.slice(0, 10).map((event) => (
              <li key={event.id} className="border-t border-soma-100 pt-3">
                {event.action === 'granted' ? 'Autorização concedida' : event.action === 'revoked' ? 'Autorização revogada' : `${event.rows_affected} leituras excluídas`}
                <span className="mt-1 block text-xs text-soma-600">{localDate(event.occurred_at)} · {event.consent_version}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {latestImport && <p className="mt-4 pb-3 text-center text-xs text-soma-600">A última importação foi em {localDate(latestImport.imported_at)}.</p>}
    </>
  )
}
