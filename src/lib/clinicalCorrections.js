import { clinicalRecordTypes } from './clinicalModules.js'

export function correctionReason(value) {
  if (
    typeof value !== 'string' ||
    value.trim().length < 3 ||
    value.trim().length > 500
  )
    throw new Error('Informe o motivo com 3 a 500 caracteres.')
  return value.trim()
}

// Resolve append-only chains once, so every chart and history uses the same current values.
export function resolveClinicalHistory(records, corrections, patientId) {
  if (!Array.isArray(corrections))
    throw new Error('Histórico de correções indisponível.')
  if (!corrections.length) return { records, historyRecords: records }
  const fail = () => {
    throw new Error('O histórico mudou ou está incompleto. Atualize a página.')
  }
  const key = (row) => `${row.kind}:${row.id}`
  const rows = new Map(records.map((row) => [key(row), row]))
  if (rows.size !== records.length) fail()
  const outgoing = new Map(),
    incoming = new Set(),
    auditIds = new Set()
  for (const change of corrections) {
    if (
      !clinicalRecordTypes[change.kind] ||
      change.patient_id !== patientId ||
      change.actor_id !== patientId ||
      !change.id ||
      auditIds.has(change.id) ||
      !Number.isFinite(Date.parse(change.created_at))
    )
      fail()
    correctionReason(change.reason)
    auditIds.add(change.id)
    const sourceKey = `${change.kind}:${change.previous_record_id}`
    const targetKey = `${change.kind}:${change.replacement_record_id}`
    const before = rows.get(sourceKey)
    const after =
      change.replacement_record_id === null ? null : rows.get(targetKey)
    if (
      !before ||
      before.patient_id !== patientId ||
      outgoing.has(sourceKey) ||
      (change.replacement_record_id !== null &&
        (!after ||
          after.patient_id !== patientId ||
          after.module_version_id !== before.module_version_id ||
          sourceKey === targetKey ||
          incoming.has(targetKey)))
    )
      fail()
    outgoing.set(sourceKey, { ...change, before, after })
    if (after) incoming.add(targetKey)
  }
  const visited = new Set(),
    historyRecords = []
  for (const root of records.filter((row) => !incoming.has(key(row)))) {
    let row = root,
      voided = false
    const audit = []
    while (true) {
      const id = key(row)
      if (visited.has(id)) fail()
      visited.add(id)
      const change = outgoing.get(id)
      if (!change) break
      audit.push(change)
      if (!change.after) {
        voided = true
        break
      }
      row = change.after
    }
    historyRecords.push({ ...row, audit, voided })
  }
  if (visited.size !== records.length) fail()
  return {
    records: historyRecords.filter((row) => !row.voided),
    historyRecords,
  }
}
