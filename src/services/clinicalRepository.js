import {
  clinicalModules,
  clinicalRecordTypes,
  localDateTime,
  validateClinicalRecord,
  validateModuleConfig,
} from '../lib/clinicalModules.js'
import {
  correctionReason,
  resolveClinicalHistory,
} from '../lib/clinicalCorrections.js'
import { createAccessRequestId } from '../lib/accessRequestId.js'

const recordTables = {
  glucose: 'glucose_readings',
  hypoglycemia: 'hypoglycemia_events',
  hba1c: 'hba1c_results',
  injection: 'injection_logs',
  gi: 'gi_symptom_logs',
  thyroid: 'thyroid_intakes',
  pressure: 'blood_pressure_readings',
}
function uuid(value, optional = false) {
  if (optional && value === null) return null
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new Error('Identificador inválido. Recarregue para continuar.')
  return value
}
function moduleKey(value) {
  if (!clinicalModules.some((module) => module.id === value))
    throw new Error('Módulo inválido.')
  return value
}

// Disabled by default. A real client alone never enables Phase 2.
export function createClinicalRepository(
  client,
  { enabled = false, now = () => new Date() } = {},
) {
  async function currentUser() {
    if (!enabled || !client)
      throw new Error('A integração clínica ainda não está liberada.')
    const { data, error } = await client.auth.getUser()
    if (error || !data?.user?.id)
      throw new Error('Sua sessão expirou. Entre novamente.')
    uuid(data.user.id)
    return data.user
  }
  function result(response) {
    if (response.error) throw response.error
    return response.data
  }
  async function rpc(name, args) {
    const user = await currentUser()
    const data = result(
      await client.rpc(name, { ...args, p_actor_id: user.id }),
    )
    if ((await currentUser()).id !== user.id)
      throw new Error('A conta mudou. Recarregue para continuar.')
    return data
  }
  async function history(table, patientId, dateKey, accessRequestId = null) {
    const rows = []
    for (let offset = 0; ; offset += 500) {
      const page = accessRequestId
        ? result(
            await client.rpc('endo_doctor_clinical_page', {
              p_patient_id: patientId,
              p_resource: table,
              p_offset: offset,
              p_limit: 500,
              p_access_request_id: accessRequestId,
            }),
          )
        : result(
            await client
              .from(table)
              .select('*')
              .eq('patient_id', patientId)
              .order(dateKey, { ascending: false })
              .order('id', { ascending: false })
              .range(offset, offset + 499),
          )
      if (!Array.isArray(page))
        throw new Error('Não foi possível confirmar o histórico clínico.')
      rows.push(
        ...page.map((row) => {
          const next = { ...row }
          for (const key of [
            'value',
            'systolic',
            'diastolic',
            'pulse',
            'glucose_low',
            'glucose_high',
            'dose_mg',
          ]) {
            if (next[key] !== null && next[key] !== undefined) {
              if (
                !['number', 'string'].includes(typeof next[key]) ||
                String(next[key]).trim() === '' ||
                !Number.isFinite(Number(next[key]))
              )
                throw new Error(
                  'Valor clínico inválido recebido. Atualize o histórico.',
                )
              next[key] = Number(next[key])
            }
          }
          for (const key of ['occurred_at', 'created_at'])
            if (next[key] instanceof Date) next[key] = next[key].toISOString()
          if (next.occurred_on instanceof Date)
            next.occurred_on = next.occurred_on.toISOString().slice(0, 10)
          return next
        }),
      )
      if (page.length < 500) return rows
    }
  }
  async function load(patientId, expectedUser = null) {
    const user = await currentUser()
    if (expectedUser !== null && user.id !== expectedUser)
      throw new Error('A conta mudou. Recarregue para continuar.')
    const accessRequestId = patientId === user.id ? null : createAccessRequestId()
    const overview = result(
      await client.rpc(
        accessRequestId
          ? 'endo_audited_clinical_overview'
          : 'endo_clinical_overview',
        accessRequestId
          ? {
              p_patient_id: patientId,
              p_access_request_id: accessRequestId,
            }
          : { p_patient_id: patientId },
      ),
    )
    if (
      !overview ||
      !Array.isArray(overview.modules) ||
      !Array.isArray(overview.permissions)
    )
      throw new Error('Não foi possível confirmar os módulos autorizados.')
    const [versions, ...recordGroups] = await Promise.all([
      history(
        'clinical_module_versions',
        patientId,
        'created_at',
        accessRequestId,
      ),
      ...Object.entries(recordTables).map(async ([kind, table]) =>
        (
          await history(
            table,
            patientId,
            kind === 'hba1c' ? 'occurred_on' : 'occurred_at',
            accessRequestId,
          )
        ).map((row) => ({ ...row, kind })),
      ),
    ])
    // Read the ledger after the records; a concurrent correction must never double-count an original.
    const corrections = await history(
      'clinical_record_corrections',
      patientId,
      'created_at',
      accessRequestId,
    )
    const resolved = resolveClinicalHistory(
      recordGroups.flat(),
      corrections,
      patientId,
    )
    // Recheck both the authenticated identity and patient authorization after pagination.
    if ((await currentUser()).id !== user.id)
      throw new Error('A conta mudou. Recarregue para continuar.')
    const fresh = result(
      await client.rpc(
        accessRequestId
          ? 'endo_audited_clinical_overview'
          : 'endo_clinical_overview',
        accessRequestId
          ? {
              p_patient_id: patientId,
              p_access_request_id: accessRequestId,
            }
          : { p_patient_id: patientId },
      ),
    )
    if (
      !fresh ||
      !Array.isArray(fresh.modules) ||
      !Array.isArray(fresh.permissions)
    )
      throw new Error('Não foi possível reconfirmar a autorização.')
    if ((await currentUser()).id !== user.id)
      throw new Error('A conta mudou. Recarregue para continuar.')
    return { ...fresh, versions, corrections, ...resolved }
  }
  function recordValues(kind, values, original) {
    const normalized = validateClinicalRecord(kind, values, now())
    const { kind: _, ...payload } = normalized
    payload.time_zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (payload.occurred_at) {
      payload.occurred_at = new Date(payload.occurred_at).toISOString()
      // Editing a value alone preserves the original instant (including seconds) and time zone.
      if (
        original?.occurred_at &&
        localDateTime(new Date(original.occurred_at)) === values.occurred_at
      ) {
        payload.occurred_at = new Date(original.occurred_at).toISOString()
        payload.time_zone = original.time_zone
      }
    } else if (original?.time_zone) payload.time_zone = original.time_zone
    return payload
  }
  function correction({ kind, record_id, request_id, reason }, values) {
    if (!Object.hasOwn(clinicalRecordTypes, kind))
      throw new Error('Tipo de registro inválido.')
    return rpc('endo_correct_clinical_record', {
      p_kind: kind,
      p_record_id: uuid(record_id),
      p_request_id: uuid(request_id),
      p_reason: correctionReason(reason),
      p_values: values,
    })
  }
  return {
    async loadMine() {
      const user = await currentUser()
      return load(user.id, user.id)
    },
    async loadPatient(patientId) {
      return load(uuid(patientId))
    },
    async grantActivation({ doctor_id, request_id, confirmed }) {
      if (confirmed !== true)
        throw new Error('Confirme a autorização de ativação separadamente.')
      return rpc('endo_grant_clinical_activation', {
        p_doctor_id: uuid(doctor_id),
        p_request_id: uuid(request_id),
        p_confirmed: true,
      })
    },
    async revokeActivation(doctorId) {
      return rpc('endo_revoke_clinical_activation', {
        p_doctor_id: uuid(doctorId),
      })
    },
    async configure({
      patient_id,
      module_key,
      expected_version,
      request_id,
      config,
    }) {
      return rpc('endo_configure_clinical_module', {
        p_patient_id: uuid(patient_id),
        p_module_key: moduleKey(module_key),
        p_expected_version: uuid(expected_version, true),
        p_request_id: uuid(request_id),
        p_config: validateModuleConfig(module_key, config),
      })
    },
    async closeModule({ module_key, expected_version }) {
      return rpc('endo_close_clinical_module', {
        p_module_key: moduleKey(module_key),
        p_expected_version: uuid(expected_version),
      })
    },
    async saveRecord({ kind, values, module_version_id, request_id }) {
      const payload = recordValues(kind, values)
      return rpc('endo_save_clinical_record', {
        p_kind: kind,
        p_module_version: uuid(module_version_id),
        p_request_id: uuid(request_id),
        p_values: payload,
      })
    },
    async correctRecord(args) {
      return correction(
        args,
        recordValues(
          args.kind,
          args.values,
          args.original?.id === args.record_id ? args.original : null,
        ),
      )
    },
    async voidRecord(args) {
      if (args.confirmed !== true)
        throw new Error('Confirme que deseja desconsiderar este registro.')
      return correction(args, null)
    },
  }
}
