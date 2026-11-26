const DAY_MS = 86400000
const DAY_IN_MONTHS = 365.2425 / 12
export const glp1PhaseTypes = [
  'titulacao', 'manutencao', 'reducao', 'suspensao', 'pos_suspensao', 'retomada',
]
export const suspensionReasons = [
  'custo', 'falta_na_farmacia', 'efeito_colateral', 'meta_atingida',
  'gestacao_ou_planejamento', 'cirurgia', 'decisao_do_paciente',
  'orientacao_medica', 'outro',
]
export const doseChangeReasons = [
  'titulacao_planejada', 'efeito_colateral', 'resposta_insuficiente',
  'disponibilidade', 'custo', 'outro',
]

function parseDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return null
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? date.getTime()
    : null
}

function nearestWeight(weights, date, windowDays = 7) {
  const target = parseDay(date)
  if (target === null) return null
  const candidates = weights
    .filter((item) => parseDay(item.date) !== null && Number.isFinite(item.kg))
    .map((item) => ({ ...item, distance: Math.abs(parseDay(item.date) - target) }))
    .filter((item) => item.distance <= windowDays * DAY_MS)
    .sort((a, b) => a.distance - b.distance || a.date.localeCompare(b.date))
  return candidates[0] ?? null
}

function inMedicationPhase(date, phases) {
  return phases.some(
    ({ start, end }) => date >= start && date <= (end ?? '9999-12-31'),
  )
}

export function regainBand(percent) {
  if (!Number.isFinite(percent)) return null
  if (percent < 25) return '<25%'
  if (percent < 50) return '25–<50%'
  if (percent < 75) return '50–<75%'
  return '≥75%'
}

export function calculateGlp1Metrics({
  startDate,
  initialWeight,
  weights = [],
  medicatedPhases = [],
  suspensionDate,
  now,
}) {
  if (!parseDay(startDate) || !Number.isFinite(initialWeight) || initialWeight <= 0)
    throw new Error('Confira a data de início e o peso inicial do curso fictício.')

  const current = nearestWeight(weights, now)
  const onTreatment = weights.filter(
    (item) => inMedicationPhase(item.date, medicatedPhases) && Number.isFinite(item.kg),
  )
  const nadir = onTreatment.length
    ? onTreatment.reduce((lowest, item) => (item.kg < lowest.kg ? item : lowest))
    : null
  const totalLossPercent = current
    ? ((initialWeight - current.kg) / initialWeight) * 100
    : null
  const lossKg = nadir ? initialWeight - nadir.kg : null
  const lossPercent = nadir ? (lossKg / initialWeight) * 100 : null
  const recoveredPercent =
    nadir && current && lossKg >= 2
      ? ((current.kg - nadir.kg) / lossKg) * 100
      : null
  const maintained80Percent =
    nadir && current && lossKg >= 2
      ? ((initialWeight - current.kg) / lossKg) * 100 >= 80
      : null

  const responseAtWeek = (weeks) => {
    const date = new Date(parseDay(startDate) + weeks * 7 * DAY_MS)
      .toISOString()
      .slice(0, 10)
    const value = nearestWeight(weights, date)
    return value ? ((initialWeight - value.kg) / initialWeight) * 100 : null
  }

  let tr50Months = null
  if (nadir && lossKg >= 2 && suspensionDate && parseDay(suspensionDate) !== null) {
    const threshold = nadir.kg + lossKg * 0.5
    const crossed = weights
      .filter((item) => item.date >= suspensionDate && item.kg >= threshold)
      .sort((a, b) => a.date.localeCompare(b.date))[0]
    if (crossed) {
      tr50Months = (parseDay(crossed.date) - parseDay(suspensionDate)) /
        DAY_MS / DAY_IN_MONTHS
    }
  }

  return {
    currentWeight: current?.kg ?? null,
    totalLossPercent,
    nadir,
    lossKg,
    lossPercent,
    recoveredPercent: lossKg < 2 ? null : recoveredPercent,
    regainBand: lossKg < 2 ? null : regainBand(recoveredPercent),
    maintained80Percent,
    responseWeek12Percent: responseAtWeek(12),
    responseWeek20Percent: responseAtWeek(20),
    tr50Months,
    smallLoss: Boolean(nadir && lossKg < 2),
  }
}

export function professionalAttentionSignals({ metrics, pendingStop, lastWeightDate, now }) {
  const signals = []
  if (pendingStop) signals.push('Paciente informou suspensão ainda não confirmada.')
  if (metrics?.recoveredPercent >= 25)
    signals.push(`O reganho passou de 25% da perda (${metrics.recoveredPercent.toFixed(0)}%).`)
  if (metrics?.recoveredPercent >= 50)
    signals.push(`O reganho passou de 50% da perda (${metrics.recoveredPercent.toFixed(0)}%).`)
  const last = parseDay(lastWeightDate)
  const current = parseDay(now)
  if (last !== null && current !== null && (current - last) / DAY_MS > 30)
    signals.push('Sem pesagem registrada há mais de 30 dias durante o seguimento.')
  if (metrics?.responseWeek20Percent !== null && metrics?.responseWeek20Percent < 5)
    signals.push('Perda inferior a 5% na semana 20.')
  return signals
}

export function reportPatientSuspension(previous, { date, reason, now = new Date() }) {
  if (!parseDay(date) || parseDay(date) > parseDay(now.toISOString().slice(0, 10)) || !suspensionReasons.includes(reason))
    throw new Error('Confira a data e o motivo informados para a suspensão.')
  if (previous?.status === 'pending' || previous?.status === 'confirmed')
    throw new Error('Este relato já foi registrado nesta demonstração.')
  return {
    status: 'pending',
    reportedAt: now.toISOString(),
    stoppedOn: date,
    reason,
    followUpStarted: false,
  }
}

export function confirmPatientSuspension(report, { professionalId, now = new Date() }) {
  if (report?.status !== 'pending')
    throw new Error('Só um relato pendente pode ser confirmado pelo profissional.')
  if (!professionalId)
    throw new Error('Identifique o profissional que confirmou no cenário fictício.')
  const start = now.toISOString().slice(0, 10)
  const end = new Date(`${start}T12:00:00Z`)
  end.setUTCFullYear(end.getUTCFullYear() + 1)
  return {
    ...report,
    status: 'confirmed',
    confirmedAt: now.toISOString(),
    confirmedBy: professionalId,
    followUpStarted: true,
    followUpStart: start,
    followUpEnd: end.toISOString().slice(0, 10),
    phase: { type: 'pos_suspensao', start, end: end.toISOString().slice(0, 10) },
  }
}

export function linkSwitchedCourse(previous, next) {
  if (!previous || !next || previous.id === next.id || !parseDay(next.startDate))
    throw new Error('Cursos distintos e data de início válida são necessários.')
  return {
    previous: { ...previous, status: 'encerrado', endedBySwitchOn: next.startDate },
    next: { ...next, previousCourseId: previous.id, status: 'ativo' },
  }
}

export function validateTreatmentPhase(phase) {
  if (!phase || !glp1PhaseTypes.includes(phase.type) || !parseDay(phase.start))
    throw new Error('Tipo de fase ou data de início inválidos.')
  if (phase.end && (!parseDay(phase.end) || phase.end < phase.start))
    throw new Error('A data final da fase deve ser igual ou posterior à inicial.')
  const drugPhase = ['titulacao', 'manutencao', 'reducao', 'retomada'].includes(phase.type)
  if (drugPhase && (!Number.isFinite(phase.doseMg) || phase.doseMg <= 0 || !phase.frequency))
    throw new Error('Registre dose e frequência informadas pelo profissional, sem gerar recomendação.')
  if (!drugPhase && (phase.doseMg != null || phase.frequency))
    throw new Error('Fases sem medicamento não recebem dose ou frequência.')
  return { ...phase }
}

export function validateDoseChange(event) {
  if (
    !event ||
    !parseDay(event.date) ||
    !doseChangeReasons.includes(event.reason) ||
    !Number.isFinite(event.newDoseMg) ||
    event.newDoseMg <= 0 ||
    (event.previousDoseMg != null && (!Number.isFinite(event.previousDoseMg) || event.previousDoseMg <= 0))
  )
    throw new Error('Confira a data, as doses registradas e o motivo da mudança.')
  return { ...event }
}
