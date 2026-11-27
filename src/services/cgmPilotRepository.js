import { createAccessRequestId } from '../lib/accessRequestId.js'

export const CGM_SOURCE = 'libreview_csv'
export const CGM_CONSENT_VERSION = 'endo-cgm-import-v1'
export const CGM_PARSER_VERSION = 'libreview-glucose-v1'
export const CGM_PDF_SOURCE = 'libreview_pdf'
export const CGM_PDF_CONSENT_VERSION = 'endo-cgm-pdf-v1'
export const CGM_PDF_PARSER_VERSION = 'libreview-agp-text-v1'
export const CGM_PDF_BUCKET = 'endo-cgm-libre-pdf'
const PAGE_SIZE = 500
const MAX_READINGS = 25000
const MAX_PDF_BYTES = 10_000_000

function assertUuid(value) {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  ) throw new Error('Identificador inválido. Recarregue para continuar.')
  return value
}

function unwrap(response, message) {
  if (response.error?.code === '22023' && response.error?.message === 'CGM patient history limit exceeded') {
    throw new Error('Esta prévia aceita até 25.000 leituras por paciente. Exclua leituras antigas antes de importar mais.')
  }
  if (response.error) throw new Error(message)
  return response.data
}

function mapPdfReport(row) {
  return {
    id: row.id,
    parseStatus: row.parse_status,
    parserVersion: row.parser_version,
    language: row.language,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    sensorActivePercent: row.sensor_active_percent,
    timeVeryHighPercent: row.time_very_high_percent,
    timeHighPercent: row.time_high_percent,
    timeInRangePercent: row.time_in_range_percent,
    timeLowPercent: row.time_low_percent,
    timeVeryLowPercent: row.time_very_low_percent,
    meanGlucoseMgDl: row.mean_glucose_mg_dl,
    gmiPercent: row.gmi_percent,
    gmiMmolMol: row.gmi_mmol_mol,
    coefficientVariationPercent: row.coefficient_variation_percent,
    device: row.device,
    createdAt: row.created_at,
  }
}

export function createCgmPilotRepository(client, { enabled = false } = {}) {
  async function currentUser() {
    if (!enabled || !client) throw new Error('A importação de CGM não está liberada neste ambiente.')
    const { data, error } = await client.auth.getUser()
    if (error || !data?.user?.id) throw new Error('Sua sessão expirou. Entre novamente.')
    return data.user
  }

  async function stillSameUser(expectedId) {
    const user = await currentUser()
    if (user.id !== expectedId) throw new Error('A conta mudou. Recarregue para continuar.')
  }

  async function rpc(name, args) {
    const user = await currentUser()
    const data = unwrap(
      await client.rpc(name, { ...args, p_actor_id: user.id }),
      'Não foi possível concluir esta operação. Atualize e tente novamente.',
    )
    await stillSameUser(user.id)
    return data
  }

  async function readOwnPages(userId, table, columns) {
    const rows = []
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const page = unwrap(
        await client
          .from(table)
          .select(columns)
          .eq('patient_id', userId)
          .eq('source_key', CGM_SOURCE)
          .order('occurred_at', { ascending: true })
          .order('id', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1),
        'Não foi possível carregar seus dados de glicose.',
      )
      if (!Array.isArray(page)) throw new Error('Resposta inválida do histórico de glicose.')
      rows.push(...page)
      if (rows.length > MAX_READINGS) throw new Error('O histórico excede o limite desta prévia de piloto.')
      if (page.length < PAGE_SIZE) return rows
      await stillSameUser(userId)
    }
  }

  return {
    async loadPatient() {
      const user = await currentUser()
      const consentResponse = await client
        .from('patient_cgm_consents')
        .select('source_key, consent_version, granted_at, revoked_at, grant_request_id')
        .eq('patient_id', user.id)
        .in('source_key', [CGM_SOURCE, CGM_PDF_SOURCE])
      const consents = unwrap(consentResponse, 'Não foi possível verificar sua autorização.')
      const consent = consents?.find((row) => row.source_key === CGM_SOURCE) ?? null
      const pdfConsent = consents?.find((row) => row.source_key === CGM_PDF_SOURCE) ?? null

      const eventsResponse = await client
        .from('patient_cgm_consent_events')
        .select('id, source_key, consent_version, action, request_id, rows_affected, occurred_at')
        .eq('patient_id', user.id)
        .order('occurred_at', { ascending: false })
        .limit(50)
      const events = unwrap(eventsResponse, 'Não foi possível carregar o histórico de autorização.')

      const importsResponse = await client
        .from('patient_cgm_imports')
        .select('id, consent_version, consent_request_id, parser_version, time_zone, submitted_rows, inserted_rows, duplicate_rows, first_reading_at, last_reading_at, imported_at')
        .eq('patient_id', user.id)
        .eq('source_key', CGM_SOURCE)
        .order('imported_at', { ascending: false })
        .limit(50)
      const imports = unwrap(importsResponse, 'Não foi possível carregar suas importações.')
      const pdfResponse = await client
        .from('patient_cgm_pdf_reports')
        .select('id, parse_status, parser_version, language, period_start, period_end, sensor_active_percent, time_very_high_percent, time_high_percent, time_in_range_percent, time_low_percent, time_very_low_percent, mean_glucose_mg_dl, gmi_percent, gmi_mmol_mol, coefficient_variation_percent, device, created_at')
        .eq('patient_id', user.id)
        .is('deleted_at', null)
        .order('period_end', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(100)
      const pdfReports = unwrap(pdfResponse, 'Não foi possível carregar seus relatórios LibreView.')
      const readings = await readOwnPages(
        user.id,
        'patient_cgm_readings',
        'id, import_id, consent_request_id, occurred_at, time_zone, glucose_mg_dl, reading_type',
      )
      await stillSameUser(user.id)
      return { consent, pdfConsent, events, imports, readings, pdfReports: (pdfReports ?? []).map(mapPdfReport) }
    },

    grantConsent(requestId = createAccessRequestId(), sourceKey = CGM_SOURCE) {
      const isPdf = sourceKey === CGM_PDF_SOURCE
      return rpc('endo_grant_cgm_consent', {
        p_source_key: sourceKey,
        p_request_id: requestId,
        p_consent_version: isPdf ? CGM_PDF_CONSENT_VERSION : CGM_CONSENT_VERSION,
        p_confirmed: true,
      })
    },

    revokeConsent(requestId = createAccessRequestId(), sourceKey = CGM_SOURCE) {
      return rpc('endo_revoke_cgm_consent', {
        p_source_key: sourceKey,
        p_request_id: requestId,
      })
    },

    deleteImportedData(requestId = createAccessRequestId()) {
      return rpc('endo_delete_cgm_imports', {
        p_source_key: CGM_SOURCE,
        p_request_id: requestId,
        p_confirmed: true,
      })
    },

    async importReadings({ format, timeZone, readings, requestId = createAccessRequestId() }) {
      if (format !== CGM_PARSER_VERSION) {
        throw new Error('Este piloto aceita somente o formato LibreView suportado por esta prévia.')
      }
      if (!Array.isArray(readings) || readings.length < 1 || readings.length > MAX_READINGS) {
        throw new Error('O CSV precisa conter de 1 a 25.000 leituras para este piloto.')
      }
      const normalized = readings.map((row) => ({
        occurred_at: row.occurredAt,
        value_mg_dl: row.valueMgDl,
        kind: row.kind,
      }))
      return rpc('endo_import_cgm_readings', {
        p_source_key: CGM_SOURCE,
        p_request_id: requestId,
        p_time_zone: timeZone,
        p_parser_version: format,
        p_readings: normalized,
      })
    },

    async savePdfReport({ file, parsed, reportId, requestId, accountId }) {
      if (!file || file.type !== 'application/pdf' || file.size < 100 || file.size > MAX_PDF_BYTES) {
        throw new Error('Selecione um PDF de até 10 MB.')
      }
      if (!parsed || !['recognized', 'unrecognized'].includes(parsed.status)
        || parsed.parserVersion !== CGM_PDF_PARSER_VERSION
        || (parsed.status === 'recognized' && (!parsed.metrics || typeof parsed.metrics !== 'object'))
        || (parsed.status === 'unrecognized' && parsed.metrics !== null)) {
        throw new Error('Não foi possível validar os dados extraídos deste PDF.')
      }
      const user = await currentUser()
      if (accountId && user.id !== accountId) throw new Error('A conta mudou. Selecione o PDF novamente para continuar.')
      assertUuid(reportId)
      assertUuid(requestId)
      const consent = await client
        .from('patient_cgm_consents')
        .select('source_key, revoked_at')
        .eq('patient_id', user.id)
        .eq('source_key', CGM_PDF_SOURCE)
        .maybeSingle()
      const currentConsent = unwrap(consent, 'Não foi possível verificar a autorização para PDF.')
      if (!currentConsent || currentConsent.revoked_at) {
        throw new Error('A autorização específica para relatórios PDF está inativa.')
      }
      const path = `${user.id}/${reportId}.pdf`
      const uploaded = await client.storage.from(CGM_PDF_BUCKET).upload(path, file, {
        contentType: 'application/pdf',
        cacheControl: '0',
        upsert: false,
      })
      const alreadyUploaded = uploaded.error
        && (String(uploaded.error.statusCode) === '409' || uploaded.error.error === 'Duplicate')
      if (uploaded.error && !alreadyUploaded) {
        throw new Error('Não foi possível guardar o PDF no armazenamento privado. Tente novamente.')
      }
      await stillSameUser(user.id)
      const metrics = parsed.status === 'recognized' ? parsed.metrics : {}
      try {
        const saved = await rpc('endo_register_cgm_pdf_report', {
          p_report_id: reportId,
          p_request_id: requestId,
          p_storage_path: path,
          p_parser_version: parsed.parserVersion,
          p_parse_status: parsed.status,
          p_metrics: metrics,
        })
        return mapPdfReport(saved)
      } catch (failure) {
        throw new Error(`${failure.message} O PDF permanece privado; tente salvar novamente com o mesmo arquivo.`)
      }
    },

    async loadDoctorPdfReports(patientId) {
      const patient = assertUuid(patientId)
      const doctor = await currentUser()
      const data = await rpc('endo_doctor_cgm_pdf_page', {
        p_patient_id: patient,
        p_request_id: createAccessRequestId(),
      })
      if (!Array.isArray(data)) throw new Error('Resposta inválida dos relatórios LibreView.')
      await stillSameUser(doctor.id)
      return data.map(mapPdfReport)
    },

    async downloadPdfReport(reportId) {
      const user = await currentUser()
      assertUuid(reportId)
      const response = unwrap(await client.functions.invoke('endo-cgm-pdf-file', {
        body: {
          action: 'read',
          report_id: reportId,
          request_id: createAccessRequestId(),
        },
      }), 'Não foi possível abrir o relatório. A autorização pode ter sido revogada.')
      await stillSameUser(user.id)
      if (!(response instanceof Blob) || response.type !== 'application/pdf' || response.size > MAX_PDF_BYTES) {
        throw new Error('O arquivo recebido não é um PDF válido.')
      }
      return response
    },

    async deletePdfReports(requestId = createAccessRequestId()) {
      assertUuid(requestId)
      const result = unwrap(await client.functions.invoke('endo-cgm-pdf-file', {
        body: { action: 'delete-all', request_id: requestId },
      }), 'Não foi possível excluir os relatórios PDF. A exclusão pode estar pendente; tente novamente.')
      return result
    },

    async loadDoctorPatient(patientId) {
      const patient = assertUuid(patientId)
      const doctor = await currentUser()
      const rows = []
      let cursor = null
      let pageLimit = PAGE_SIZE
      while (true) {
        const page = unwrap(
          await client.rpc('endo_doctor_cgm_page', {
            p_actor_id: doctor.id,
            p_patient_id: patient,
            p_request_id: createAccessRequestId(),
            p_after_occurred_at: cursor?.occurred_at ?? null,
            p_after_id: cursor?.id ?? null,
            p_limit: pageLimit,
          }),
          'Não foi possível confirmar o consentimento e o acesso ao módulo Diabetes.',
        )
        if (!Array.isArray(page)) throw new Error('Resposta inválida do histórico de glicose.')
        rows.push(...page)
        await stillSameUser(doctor.id)
        if (rows.length > MAX_READINGS) throw new Error('O histórico excede o limite desta prévia de piloto.')
        if (page.length < pageLimit) return rows
        cursor = page.at(-1)
        pageLimit = Math.min(PAGE_SIZE, Math.max(1, MAX_READINGS - rows.length))
      }
    },
  }
}
