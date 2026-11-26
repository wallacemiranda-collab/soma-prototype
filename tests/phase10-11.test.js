import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { calculateGlp1Metrics, confirmPatientSuspension, linkSwitchedCourse, professionalAttentionSignals, reportPatientSuspension, validateDoseChange, validateTreatmentPhase } from '../src/lib/glp1Treatment.js'
import { agpByHour, calculateCgmMetrics, mergeGlucoseImports, parseLibreViewCsv } from '../src/lib/cgmImport.js'
import { makeDemoGlucoseCsv } from '../src/data/demoGlucoseCsv.js'
import { demoGlp1Course } from '../src/data/demoGlp1Course.js'

const courseInput = {
  ...demoGlp1Course,
  medicatedPhases: demoGlp1Course.phases
    .filter((phase) => ['titulação', 'manutenção', 'redução'].includes(phase.type))
    .map(({ start, end }) => ({ start, end })),
  now: '2026-11-26',
}

test('GLP-1 demo calculates treatment and six-month follow-up outcomes', () => {
  const metrics = calculateGlp1Metrics(courseInput)
  assert.equal(metrics.currentWeight, 96)
  assert.equal(metrics.nadir.date, '2026-04-28')
  assert.equal(metrics.nadir.kg, 87.8)
  assert.ok(Math.abs(metrics.lossKg - 22.2) < 1e-9)
  assert.ok(Math.abs(metrics.responseWeek12Percent - 5.636363636363637) < 1e-9)
  assert.ok(Math.abs(metrics.responseWeek20Percent - 9.545454545454545) < 1e-9)
  assert.equal(metrics.regainBand, '25–<50%')
  assert.equal(metrics.maintained80Percent, false)
  assert.equal(metrics.tr50Months, null)
})

test('GLP-1 metrics preserve regain above 100%, bands, small loss and ±7-day windows', () => {
  const base = {
    startDate: '2025-01-01',
    initialWeight: 100,
    medicatedPhases: [{ start: '2025-01-01', end: '2025-03-01' }],
    now: '2025-02-01',
    weights: [
      { date: '2025-01-01', kg: 100 },
      { date: '2025-01-10', kg: 90 },
      { date: '2025-02-01', kg: 105 },
    ],
  }
  const metrics = calculateGlp1Metrics({ ...base, suspensionDate: '2025-01-15' })
  assert.equal(metrics.recoveredPercent, 150)
  assert.equal(metrics.regainBand, '≥75%')
  assert.equal(metrics.maintained80Percent, false)
  assert.ok(metrics.tr50Months > 0)
  assert.equal(calculateGlp1Metrics({ ...base, now: '2025-04-01' }).currentWeight, null)
  const noSmallRegain = calculateGlp1Metrics({
    ...base,
    weights: [{ date: '2025-01-01', kg: 100 }, { date: '2025-01-10', kg: 99 }, { date: '2025-02-01', kg: 100 }],
  })
  assert.equal(noSmallRegain.smallLoss, true)
  assert.equal(noSmallRegain.recoveredPercent, null)
  assert.equal(noSmallRegain.regainBand, null)
  assert.equal(noSmallRegain.maintained80Percent, null)
})

test('professional attention signals are descriptive and not patient-facing', () => {
  const metrics = calculateGlp1Metrics({
    startDate: '2025-01-01', initialWeight: 100,
    medicatedPhases: [{ start: '2025-01-01', end: '2025-02-01' }],
    now: '2025-02-10',
    weights: [{ date: '2025-01-01', kg: 100 }, { date: '2025-01-15', kg: 94 }, { date: '2025-02-10', kg: 99 }],
  })
  const signals = professionalAttentionSignals({ metrics, pendingStop: true, lastWeightDate: '2025-01-01', now: '2025-02-10' })
  assert.equal(signals.length, 4)
  assert.ok(signals.every((signal) => !/retome|aumente|reduza|recomend/i.test(signal)))
})

test('LibreView-like example CSV formats detect units, delimiters, local dates and deduplicate', async () => {
  const english = await readFile(new URL('./fixtures/libreview-example.csv', import.meta.url), 'utf8')
  const portuguese = await readFile(new URL('./fixtures/libreview-example-pt.csv', import.meta.url), 'utf8')
  const parsedEnglish = parseLibreViewCsv(`${english}${english.split('\n').at(-2)}\n`)
  assert.equal(parsedEnglish.format, 'libreview-glucose-v1')
  assert.equal(parsedEnglish.delimiter, ',')
  assert.equal(parsedEnglish.readings.length, 4)
  assert.equal(parsedEnglish.readings.at(-1).kind, 'scanned')
  const parsedPortuguese = parseLibreViewCsv(portuguese)
  assert.equal(parsedPortuguese.delimiter, ';')
  assert.equal(parsedPortuguese.readings[0].originalUnit, 'mmol/L')
  assert.equal(parsedPortuguese.readings[0].valueMgDl, 126.1)
  assert.match(parsedPortuguese.readings[0].occurredAt, /T11:00:00\.000Z$/)
  assert.throws(() => parseLibreViewCsv('Nome;Email\nPessoa;email@example.com'), /Não reconhecemos/)
  const merged = mergeGlucoseImports(parsedEnglish, parsedEnglish)
  assert.equal(merged.readings.length, parsedEnglish.readings.length)
})

test('CGM demo file has a complete synthetic 14-day series and metrics use 70% minimum', () => {
  const sample = parseLibreViewCsv(makeDemoGlucoseCsv({ days: 14, endDate: new Date('2026-11-26T12:00:00-03:00') }))
  assert.equal(sample.readings.filter((row) => row.kind === 'automatic').length, 1344)
  const firstDay = new Intl.DateTimeFormat('en-CA', { timeZone: sample.timeZone }).format(new Date(sample.readings[0].occurredAt))
  const lastDay = new Intl.DateTimeFormat('en-CA', { timeZone: sample.timeZone }).format(new Date(sample.readings.at(-1).occurredAt))
  assert.equal(firstDay, '2026-11-13')
  assert.equal(lastDay, '2026-11-26')
  const from = sample.readings[0].occurredAt
  const to = new Date(Date.parse(sample.readings.at(-1).occurredAt) + 14 * 60000).toISOString()
  const metrics = calculateCgmMetrics(sample.readings, { start: from, end: to, expectedIntervalMinutes: 15 })
  assert.equal(metrics.sufficient, true)
  assert.equal(metrics.wearPercent, 100)
  assert.ok(metrics.gmi > 3.31)
  assert.ok(metrics.timeInRange >= 0 && metrics.timeInRange <= 100)

  const sparse = calculateCgmMetrics(sample.readings.slice(0, 10), { start: from, end: to, expectedIntervalMinutes: 15 })
  assert.equal(sparse.sufficient, false)
  assert.ok(sparse.wearPercent < 70)
})

test('CGM metrics, scanned rows, AGP and sample calculations', () => {
  const readings = [54, 70, 180, 251].map((value, index) => ({
    occurredAt: new Date(Date.UTC(2026, 0, 1, 3, index * 15)).toISOString(),
    valueMgDl: value,
    kind: 'automatic',
    timeZone: 'America/Sao_Paulo',
  }))
  readings.push({ ...readings[0], kind: 'scanned', valueMgDl: 400 })
  const metrics = calculateCgmMetrics(readings, {
    start: readings[0].occurredAt,
    end: readings[3].occurredAt,
    expectedIntervalMinutes: 15,
  })
  assert.equal(metrics.sufficient, true)
  assert.equal(metrics.meanMgDl, 138.75)
  assert.equal(metrics.timeInRange, 50)
  assert.equal(metrics.belowRange, 25)
  assert.equal(metrics.below54, 0)
  assert.equal(metrics.aboveRange, 25)
  assert.equal(metrics.above250, 25)
  assert.equal(metrics.gmi, 3.31 + 0.02392 * 138.75)
  assert.equal(agpByHour(readings)[0].count, 4)
  assert.throws(() => calculateCgmMetrics(readings, { start: 'invalid', end: 'invalid' }), /período válido/)
})

test('patient stop report never starts follow-up until a professional confirms it', () => {
  const pending = reportPatientSuspension(null, {
    date: '2026-11-26', reason: 'decisao_do_paciente', now: new Date('2026-11-26T12:00:00Z'),
  })
  assert.equal(pending.status, 'pending')
  assert.equal(pending.followUpStarted, false)
  assert.throws(() => confirmPatientSuspension(pending, { professionalId: null }), /profissional/)
  const confirmed = confirmPatientSuspension(pending, {
    professionalId: 'demo-professional-a', now: new Date('2026-11-26T12:00:00Z'),
  })
  assert.equal(confirmed.followUpStarted, true)
  assert.equal(confirmed.followUpStart, '2026-11-26')
  assert.equal(confirmed.followUpEnd, '2027-11-26')
  assert.equal(confirmed.phase.type, 'pos_suspensao')
})

test('treatment phase, dose-change and medication-switch records validate closed sets', () => {
  assert.equal(validateTreatmentPhase({ type: 'manutencao', start: '2026-01-01', doseMg: 1, frequency: 'semanal' }).type, 'manutencao')
  assert.throws(() => validateTreatmentPhase({ type: 'manutencao', start: '2026-01-01' }), /dose e frequência/)
  assert.throws(() => validateDoseChange({ date: '2026-01-01', previousDoseMg: 1, newDoseMg: 2, reason: 'dose_maior' }), /motivo/)
  const event = validateDoseChange({ date: '2026-01-01', previousDoseMg: 1, newDoseMg: 2, reason: 'titulacao_planejada' })
  assert.equal(event.reason, 'titulacao_planejada')
  const switched = linkSwitchedCourse({ id: 'old', startDate: '2025-01-01' }, { id: 'new', startDate: '2026-01-01' })
  assert.equal(switched.previous.status, 'encerrado')
  assert.equal(switched.next.previousCourseId, 'old')
})

test('patient-facing component receives no professional attention signals or trial overlay', () => {
  const source = readFileSync(new URL('../src/screens/IntegrationsPreview.jsx', import.meta.url), 'utf8')
  const flags = readFileSync(new URL('../src/config/phase10.js', import.meta.url), 'utf8')
  const patientView = source.split('function PatientTreatment')[1].split('function ProfessionalTreatment')[0]
  assert.doesNotMatch(patientView, /attention|ensaio|referência|trial/i)
  assert.match(source, /!isProfessional \? \(\s*<PatientTreatment metrics=\{treatmentMetrics\} report=\{report\}/)
  assert.match(source, /<ProfessionalTreatment metrics=\{treatmentMetrics\} signals=\{phaseSignals\}/)
  assert.match(flags, /RESEARCH_EXPORT_ENABLED = false/)
})
