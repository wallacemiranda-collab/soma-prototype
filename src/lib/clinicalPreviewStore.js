import {
  clinicalModules,
  clinicalRecordTypes,
  previewDoctors,
  validateClinicalRecord,
  validateModuleConfig,
} from './clinicalModules.js'

export const clinicalPreviewKey = 'endo-clinical-preview-v1'
export function emptyClinicalPreview() {
  return {
    permissions: Object.fromEntries(
      previewDoctors.map((doctor) => [doctor.id, { allowed: false, epoch: 0 }]),
    ),
    modules: {},
    records: [],
  }
}
export function moduleIsActive(state, moduleId) {
  const module = state.modules[moduleId]
  const permission = state.permissions[module?.doctorId]
  return Boolean(
    module?.enabled &&
      permission?.allowed &&
      module.permissionEpoch === permission.epoch,
  )
}
export function changeClinicalPermission(state, doctorId, allowed) {
  if (
    !previewDoctors.some((doctor) => doctor.id === doctorId) ||
    typeof allowed !== 'boolean'
  )
    throw new Error('Permissão inválida.')
  const old = state.permissions[doctorId]
  if (old.allowed === allowed) return state
  return {
    ...state,
    permissions: {
      ...state.permissions,
      [doctorId]: { allowed, epoch: old.epoch + 1 },
    },
  }
}
export function configureClinicalModule(state, doctorId, moduleId, config) {
  const permission = state.permissions[doctorId]
  if (!permission?.allowed)
    throw new Error('O paciente precisa autorizar a ativação separadamente.')
  const old = state.modules[moduleId]
  if (old?.enabled && old.doctorId !== doctorId)
    throw new Error(
      'Outro médico é responsável por este módulo. O paciente precisa encerrá-lo antes de trocar o responsável.',
    )
  const next = {
    enabled: true,
    doctorId,
    permissionEpoch: permission.epoch,
    revision: (old?.revision ?? 0) + 1,
    config: validateModuleConfig(moduleId, config),
  }
  return { ...state, modules: { ...state.modules, [moduleId]: next } }
}
export function closeClinicalModule(state, moduleId) {
  if (!clinicalModules.some((module) => module.id === moduleId))
    throw new Error('Módulo inválido.')
  if (!state.modules[moduleId]) return state
  return {
    ...state,
    modules: {
      ...state.modules,
      [moduleId]: { ...state.modules[moduleId], enabled: false },
    },
  }
}
export function appendClinicalRecord(
  state,
  kind,
  values,
  id,
  now = new Date(),
) {
  const moduleId = clinicalRecordTypes[kind]?.module
  if (!moduleIsActive(state, moduleId))
    throw new Error(
      'Este módulo não está ativo. Seus registros anteriores foram preservados.',
    )
  if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,90}$/.test(id))
    throw new Error('Registro inválido.')
  if (state.records.some((row) => row.id === id)) return state
  if (state.records.length >= 1000)
    throw new Error('Limite da simulação atingido. Reinicie a demonstração.')
  const record = { ...validateClinicalRecord(kind, values, now), id }
  if (kind === 'injection') {
    if (record.occurred_at.slice(0, 10) < state.modules.glp1.config.anchor_date)
      throw new Error(
        'A aplicação é anterior à primeira data deste esquema. Confira o esquema com seu médico; não usamos uma dose nova para preencher o passado.',
      )
    record.plan_revision = state.modules.glp1.revision
    record.plan_snapshot = { ...state.modules.glp1.config }
  }
  return { ...state, records: [record, ...state.records] }
}

function normalize(value) {
  if (!value || !Array.isArray(value.records) || value.records.length > 1000)
    throw new Error('Invalid clinical preview')
  const state = emptyClinicalPreview()
  for (const doctor of previewDoctors) {
    const permission = value.permissions?.[doctor.id]
    if (
      !permission ||
      typeof permission.allowed !== 'boolean' ||
      !Number.isSafeInteger(permission.epoch) ||
      permission.epoch < 0
    )
      throw new Error('Invalid permission')
    state.permissions[doctor.id] = {
      allowed: permission.allowed,
      epoch: permission.epoch,
    }
  }
  for (const { id } of clinicalModules) {
    const module = value.modules?.[id]
    if (!module) continue
    if (
      typeof module.enabled !== 'boolean' ||
      !previewDoctors.some((doctor) => doctor.id === module.doctorId) ||
      !Number.isSafeInteger(module.permissionEpoch) ||
      module.permissionEpoch < 0 ||
      !Number.isSafeInteger(module.revision) ||
      module.revision < 1
    )
      throw new Error('Invalid module')
    state.modules[id] = {
      enabled: module.enabled,
      doctorId: module.doctorId,
      permissionEpoch: module.permissionEpoch,
      revision: module.revision,
      config: validateModuleConfig(id, module.config),
    }
  }
  const ids = new Set()
  state.records = value.records.map((row) => {
    if (
      typeof row.id !== 'string' ||
      !/^[a-zA-Z0-9-]{1,90}$/.test(row.id) ||
      ids.has(row.id)
    )
      throw new Error('Invalid record identity')
    ids.add(row.id)
    const input =
      row.kind === 'gi'
        ? {
            ...row,
            ...Object.fromEntries(
              ['nausea', 'vomiting', 'constipation', 'diarrhea', 'reflux'].map(
                (key) => [key, String(row[key])],
              ),
            ),
          }
        : row
    const result = { ...validateClinicalRecord(row.kind, input), id: row.id }
    if (row.kind === 'injection') {
      if (!Number.isSafeInteger(row.plan_revision) || row.plan_revision < 1)
        throw new Error('Invalid plan revision')
      result.plan_revision = row.plan_revision
      result.plan_snapshot = validateModuleConfig('glp1', row.plan_snapshot)
    }
    return result
  })
  return state
}

function browserStorage() {
  try {
    return globalThis.sessionStorage
  } catch {
    return undefined
  }
}
export function createClinicalPreviewStore(storage = browserStorage()) {
  let memory = null
  let persistent = Boolean(storage)
  function clear() {
    memory = null
    try {
      storage?.removeItem(clinicalPreviewKey)
    } catch {
      persistent = false
    }
  }
  function read() {
    let raw = null
    try {
      raw = persistent ? storage.getItem(clinicalPreviewKey) : null
    } catch {
      persistent = false
    }
    try {
      if (raw !== null) {
        if (raw.length > 750000) throw new Error('Oversized preview')
        const snapshot = JSON.parse(raw)
        if (snapshot.version !== 1 || snapshot.mode !== 'clinical-demo')
          throw new Error('Invalid preview version')
        memory = normalize(snapshot.data)
      }
      return memory ? normalize(memory) : emptyClinicalPreview()
    } catch {
      clear()
      return emptyClinicalPreview()
    }
  }
  function save(value) {
    memory = normalize(value)
    if (persistent) {
      try {
        storage.setItem(
          clinicalPreviewKey,
          JSON.stringify({ version: 1, mode: 'clinical-demo', data: memory }),
        )
      } catch {
        persistent = false
      }
    }
    return normalize(memory)
  }
  return { read, save, clear }
}
export const clinicalPreviewStore = createClinicalPreviewStore()
