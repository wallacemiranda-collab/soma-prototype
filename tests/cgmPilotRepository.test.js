import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CGM_CONSENT_VERSION,
  CGM_PARSER_VERSION,
  CGM_PDF_CONSENT_VERSION,
  CGM_PDF_PARSER_VERSION,
  CGM_PDF_SOURCE,
  CGM_SOURCE,
  createCgmPilotRepository,
} from '../src/services/cgmPilotRepository.js'

function mockClient({ userIds = ['11111111-1111-4111-8111-111111111111'], rpc } = {}) {
  let userIndex = 0
  const calls = []
  return {
    calls,
    auth: {
      async getUser() {
        const id = userIds[Math.min(userIndex++, userIds.length - 1)]
        return { data: { user: { id } }, error: null }
      },
    },
    async rpc(name, args) {
      calls.push({ name, args })
      return rpc ? rpc(name, args) : { data: { ok: true }, error: null }
    },
  }
}

test('CGM repository refuses calls unless the pilot flag is explicitly enabled', async () => {
  const client = mockClient()
  const repository = createCgmPilotRepository(client)
  await assert.rejects(repository.grantConsent(), /não está liberada/)
  assert.equal(client.calls.length, 0)
})

test('consent and imports send only normalized values with the authenticated actor', async () => {
  const client = mockClient()
  const repository = createCgmPilotRepository(client, { enabled: true })
  await repository.grantConsent()
  await repository.importReadings({
    format: CGM_PARSER_VERSION,
    timeZone: 'America/Sao_Paulo',
    readings: [{
      occurredAt: '2026-11-26T13:00:00.000Z',
      valueMgDl: 112.4,
      kind: 'automatic',
      originalValue: 6.2,
      originalUnit: 'mmol/L',
    }],
  })
  assert.equal(client.calls[0].name, 'endo_grant_cgm_consent')
  assert.equal(client.calls[0].args.p_actor_id, '11111111-1111-4111-8111-111111111111')
  assert.equal(client.calls[0].args.p_source_key, CGM_SOURCE)
  assert.equal(client.calls[0].args.p_consent_version, CGM_CONSENT_VERSION)
  const imported = client.calls[1]
  assert.equal(imported.name, 'endo_import_cgm_readings')
  assert.deepEqual(imported.args.p_readings, [{
    occurred_at: '2026-11-26T13:00:00.000Z',
    value_mg_dl: 112.4,
    kind: 'automatic',
  }])
  assert.equal(imported.args.p_actor_id, '11111111-1111-4111-8111-111111111111')
})

test('unsupported parser formats are rejected before contacting the backend', async () => {
  const client = mockClient()
  const repository = createCgmPilotRepository(client, { enabled: true })
  await assert.rejects(
    repository.importReadings({ format: 'compatible-glucose-csv-v1', timeZone: 'UTC', readings: [] }),
    /formato LibreView/,
  )
  assert.equal(client.calls.length, 0)
})

test('a retried consent action can reuse its request identity', async () => {
  const client = mockClient()
  const repository = createCgmPilotRepository(client, { enabled: true })
  const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  await repository.grantConsent(requestId)
  await repository.grantConsent(requestId)
  assert.equal(client.calls[0].args.p_request_id, requestId)
  assert.equal(client.calls[1].args.p_request_id, requestId)
})

test('PDF consent is separate from CSV consent and uses the PDF-specific version', async () => {
  const client = mockClient()
  const repository = createCgmPilotRepository(client, { enabled: true })
  const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  await repository.grantConsent(requestId, CGM_PDF_SOURCE)
  await repository.revokeConsent(requestId, CGM_PDF_SOURCE)
  assert.equal(client.calls[0].args.p_source_key, CGM_PDF_SOURCE)
  assert.equal(client.calls[0].args.p_consent_version, CGM_PDF_CONSENT_VERSION)
  assert.equal(client.calls[1].args.p_source_key, CGM_PDF_SOURCE)
  assert.equal(client.calls[1].args.p_consent_version, undefined)
})

test('PDF save uploads only after local parsing and registers normalized metrics without identity fields', async () => {
  const userId = '11111111-1111-4111-8111-111111111111'
  const reportId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const requestId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  const calls = []
  const mockFile = new Blob([new Uint8Array(200)], { type: 'application/pdf' })
  mockFile.name = 'patient-name-report.pdf'
  const client = {
    auth: { async getUser() { return { data: { user: { id: userId } }, error: null } } },
    from(table) {
      assert.equal(table, 'patient_cgm_consents')
      return {
        select() { return this },
        eq() { return this },
        maybeSingle() { return Promise.resolve({ data: { source_key: CGM_PDF_SOURCE, revoked_at: null }, error: null }) },
      }
    },
    storage: { from(bucket) {
      assert.equal(bucket, 'endo-cgm-libre-pdf')
      return { async upload(path, file, options) { calls.push({ path, file, options }); return { data: { path }, error: null } } }
    } },
    async rpc(name, args) {
      calls.push({ name, args })
      return { data: { id: reportId, parse_status: args.p_parse_status }, error: null }
    },
  }
  const repository = createCgmPilotRepository(client, { enabled: true })
  const metrics = {
    language: 'pt', periodStart: '2026-11-01', periodEnd: '2026-11-14',
    sensorActivePercent: 68, timeVeryHighPercent: 2, timeHighPercent: 8,
    timeInRangePercent: 78, timeLowPercent: 10, timeVeryLowPercent: 2,
    meanGlucoseMgDl: 145, gmiPercent: 6.7, gmiMmolMol: 50,
    coefficientVariationPercent: 34.5, device: 'FreeStyle Libre 3',
  }
  const saved = await repository.savePdfReport({
    file: mockFile,
    reportId,
    requestId,
    parsed: { status: 'recognized', parserVersion: CGM_PDF_PARSER_VERSION, metrics },
  })
  assert.equal(saved.parseStatus, 'recognized')
  assert.equal(calls[0].path, `${userId}/${reportId}.pdf`)
  assert.equal(calls[0].options.contentType, 'application/pdf')
  assert.equal(calls[1].name, 'endo_register_cgm_pdf_report')
  assert.deepEqual(calls[1].args.p_metrics, metrics)
  assert.equal('patientName' in calls[1].args.p_metrics, false)
  assert.equal('name' in calls[1].args, false)
  assert.equal('fileName' in calls[1].args, false)
})

test('doctor history uses the database-gated cursor RPC and rechecks the session', async () => {
  const firstPage = Array.from({ length: 500 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    occurred_at: `2026-11-26T13:${String(index % 60).padStart(2, '0')}:00.000Z`,
  }))
  const client = mockClient({
    rpc: (name) => ({
      data: name === 'endo_doctor_cgm_page' && client.calls.length === 1 ? firstPage : [{ id: 'last', occurred_at: '2026-11-26T14:00:00.000Z' }],
      error: null,
    }),
  })
  const repository = createCgmPilotRepository(client, { enabled: true })
  const rows = await repository.loadDoctorPatient('22222222-2222-4222-8222-222222222222')
  assert.equal(rows.length, 501)
  assert.equal(client.calls.length, 2)
  assert.equal(client.calls[0].args.p_after_id, null)
  assert.equal(client.calls[1].args.p_after_id, firstPage.at(-1).id)
  assert.notEqual(client.calls[0].args.p_request_id, client.calls[1].args.p_request_id)
})

test('doctor history supports the exact pilot maximum and rejects a larger result', async () => {
  async function loadHistory(overflow) {
    let pageNumber = 0
    const client = mockClient({
      rpc: (name, args) => {
        if (name !== 'endo_doctor_cgm_page') return { data: null, error: null }
        const currentPage = pageNumber++
        const count = currentPage < 50 ? 500 : overflow && currentPage === 50 ? 1 : 0
        const start = currentPage * 500
        return {
          data: Array.from({ length: count }, (_, index) => ({
            id: `00000000-0000-4000-8000-${String(start + index + 1).padStart(12, '0')}`,
            occurred_at: new Date(Date.UTC(2026, 0, 1, 0, 0, start + index)).toISOString(),
          })),
          error: null,
        }
      },
    })
    const repository = createCgmPilotRepository(client, { enabled: true })
    return { rows: repository.loadDoctorPatient('22222222-2222-4222-8222-222222222222'), client }
  }

  const maximum = await loadHistory(false)
  const rows = await maximum.rows
  assert.equal(rows.length, 25000)
  assert.equal(maximum.client.calls.length, 51)
  assert.equal(maximum.client.calls.at(-1).args.p_limit, 1)

  const oversized = await loadHistory(true)
  await assert.rejects(oversized.rows, /excede o limite/)
})

test('repository discards a response if the authenticated account changes during an operation', async () => {
  const client = mockClient({
    userIds: [
      '11111111-1111-4111-8111-111111111111',
      '33333333-3333-4333-8333-333333333333',
    ],
  })
  const repository = createCgmPilotRepository(client, { enabled: true })
  await assert.rejects(repository.grantConsent(), /A conta mudou/)
})
