import { FileText, LockKeyhole, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Card } from './ui'

const metrics = [
  ['Tempo ativo do sensor', 'sensorActivePercent', '%'],
  ['Muito alto · >250 mg/dL', 'timeVeryHighPercent', '%'],
  ['Alto · 181–250 mg/dL', 'timeHighPercent', '%'],
  ['No alvo · 70–180 mg/dL', 'timeInRangePercent', '%'],
  ['Baixo · 54–69 mg/dL', 'timeLowPercent', '%'],
  ['Muito baixo · <54 mg/dL', 'timeVeryLowPercent', '%'],
  ['Glicose média', 'meanGlucoseMgDl', ' mg/dL'],
  ['GMI', 'gmiPercent', '%'],
  ['GMI', 'gmiMmolMol', ' mmol/mol'],
  ['Coeficiente de variação', 'coefficientVariationPercent', '%'],
]

function amount(value, unit) {
  return `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}${unit}`
}

function period(report) {
  if (!report.periodStart || !report.periodEnd) return 'Período não reconhecido'
  const format = (value) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
  return `${format(report.periodStart)} a ${format(report.periodEnd)}`
}

function comparisonValue(current, previous) {
  if (!Number.isFinite(Number(current)) || !Number.isFinite(Number(previous))) return null
  const delta = Number(current) - Number(previous)
  if (Math.abs(delta) < 0.05) return 'sem variação'
  const sign = delta > 0 ? '+' : '−'
  return `${sign}${Math.abs(delta).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}`
}

export function LibreViewAgpReportCard({ report, previousReport, previewUrl, loading = false, onOpen }) {
  const recognized = report.parseStatus === 'recognized'
  const below70 = recognized ? Number(report.timeLowPercent) + Number(report.timeVeryLowPercent) : null
  const previousBelow70 = previousReport?.parseStatus === 'recognized'
    ? Number(previousReport.timeLowPercent) + Number(previousReport.timeVeryLowPercent)
    : null

  return (
    <Card className="mt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-soma-900">
            <FileText size={18} /> Relatório LibreView
          </h3>
          <p className="mt-1 text-sm text-soma-700">{period(report)}</p>
        </div>
        <span className="rounded-full bg-soma-100 px-3 py-1 text-xs font-semibold text-soma-800">
          {recognized ? 'Extraídos do relatório' : 'Anexo guardado'}
        </span>
      </div>

      {!recognized ? (
        <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          Formato não reconhecido. O arquivo ficou guardado como anexo privado; nenhuma métrica foi estimada.
        </p>
      ) : (
        <>
          {Number(report.sensorActivePercent) < 70 && (
            <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-medium leading-6 text-amber-950">
              Uso do sensor abaixo de 70%: interprete com cautela
            </p>
          )}
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
            {metrics.map(([label, field, unit]) => (
              <div key={field} className="border-b border-soma-100 pb-2">
                <dt className="text-xs leading-5 text-soma-600">{label}</dt>
                <dd className="mt-0.5 font-semibold text-soma-900">{amount(report[field], unit)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-soma-600">Dispositivo: {report.device}</p>

          {previousReport?.parseStatus === 'recognized' && (
            <section className="mt-5 rounded-xl bg-soma-50 p-4" aria-label="Comparação com relatório anterior">
              <h4 className="text-sm font-semibold text-soma-900">Comparação com o relatório anterior</h4>
              <p className="mt-1 text-xs text-soma-600">{period(previousReport)} → {period(report)}</p>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-soma-600">Tempo no alvo</dt><dd className="font-semibold text-soma-900">{comparisonValue(report.timeInRangePercent, previousReport.timeInRangePercent)} p.p.</dd></div>
                <div><dt className="text-xs text-soma-600">Abaixo de 70 mg/dL</dt><dd className="font-semibold text-soma-900">{comparisonValue(below70, previousBelow70)} p.p.</dd></div>
                <div><dt className="text-xs text-soma-600">GMI</dt><dd className="font-semibold text-soma-900">{comparisonValue(report.gmiPercent, previousReport.gmiPercent)} p.p.</dd></div>
                <div><dt className="text-xs text-soma-600">CV</dt><dd className="font-semibold text-soma-900">{comparisonValue(report.coefficientVariationPercent, previousReport.coefficientVariationPercent)} p.p.</dd></div>
              </dl>
            </section>
          )}
        </>
      )}

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <div className="flex min-h-20 flex-col justify-center rounded-xl bg-soma-50 p-4 text-sm text-soma-700">
          <span className="flex items-center gap-2 font-semibold text-soma-800"><LockKeyhole size={16} /> PDF em armazenamento privado</span>
          <span className="mt-1 text-xs">A abertura do arquivo é registrada. Nenhum dado pessoal do PDF é copiado para as métricas.</span>
        </div>
        <button
          type="button"
          disabled={loading || Boolean(previewUrl)}
          onClick={onOpen}
          className="flex min-h-20 items-center justify-center gap-2 rounded-xl border border-soma-200 px-4 py-3 text-sm font-semibold text-soma-800 disabled:opacity-60"
        >
          {loading ? <LoaderCircle size={17} className="animate-spin" /> : <FileText size={17} />}
          {previewUrl ? 'Relatório aberto abaixo' : 'Abrir PDF para conferência'}
        </button>
      </div>
      {previewUrl && (
        <div className="mt-4 overflow-hidden rounded-xl border border-soma-200">
          <iframe title="Relatório LibreView" src={previewUrl} className="h-[32rem] w-full bg-white" />
          <a href={previewUrl} target="_blank" rel="noreferrer" className="block border-t border-soma-100 p-3 text-center text-sm font-semibold text-soma-700 underline">
            Abrir o PDF em outra janela
          </a>
        </div>
      )}
    </Card>
  )
}

export function LibreViewReportPreview({ file, parsed }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!file) {
      setUrl('')
      return undefined
    }
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])
  if (!file || !parsed) return null
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="overflow-hidden rounded-xl border border-soma-200 bg-white">
        <iframe title="Prévia do relatório LibreView" src={url} className="h-[30rem] w-full" />
      </div>
      <Card className="mt-0">
        <h3 className="font-semibold text-soma-900">Conferir antes de guardar</h3>
        <p className="mt-2 text-xs leading-5 text-soma-600">Os valores são extraídos localmente do texto do relatório. O nome e demais dados pessoais não são copiados para o registro.</p>
        {parsed.status === 'recognized' ? (
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            {metrics.map(([label, field, unit]) => (
              <div key={field}>
                <dt className="text-xs text-soma-600">{label}</dt>
                <dd className="font-semibold text-soma-900">{amount(parsed.metrics[field], unit)}</dd>
              </div>
            ))}
            <div className="col-span-2"><dt className="text-xs text-soma-600">Período</dt><dd className="font-semibold text-soma-900">{period(parsed.metrics)}</dd></div>
            <div className="col-span-2"><dt className="text-xs text-soma-600">Dispositivo</dt><dd className="font-semibold text-soma-900">{parsed.metrics.device}</dd></div>
          </dl>
        ) : (
          <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">Formato não reconhecido. Se guardar, somente o anexo privado será mantido, sem métricas.</p>
        )}
        {parsed.status === 'recognized' && parsed.metrics.sensorActivePercent < 70 && (
          <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-medium leading-6 text-amber-950">Uso do sensor abaixo de 70%: interprete com cautela</p>
        )}
      </Card>
    </div>
  )
}
