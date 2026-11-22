import test from 'node:test'
import assert from 'node:assert/strict'
import { createClinicalRepository } from '../src/services/clinicalRepository.js'

const patient = '11111111-1111-4111-8111-111111111111'
const doctor = '22222222-2222-4222-8222-222222222222'
const version = '33333333-3333-4333-8333-333333333333'
const request = '44444444-4444-4444-8444-444444444444'
function fixture(options = {}) {
  const calls = []
  let authCalls = 0
  let overviewCalls = 0
  const client = {
    auth: {
      async getUser() {
        authCalls++
        return {
          data: {
            user: options.noSession
              ? null
              : {
                  id: options.changeAccount && authCalls > 1 ? doctor : patient,
                },
          },
          error: options.authError,
        }
      },
    },
    async rpc(name, args) {
      calls.push({ rpc: name, args })
      if (name === 'endo_clinical_overview') {
        overviewCalls++
        return {
          data: options.malformedOverview
            ? {}
            : { modules: [], permissions: [] },
          error:
            options.revokeAfterRead && overviewCalls > 1
              ? Error('Revoked')
              : options.error,
        }
      }
      return { data: { id: request }, error: options.error }
    },
    from(table) {
      const call = { table, filters: [], orders: [] }
      calls.push(call)
      const chain = {
        select() {
          return chain
        },
        eq(key, value) {
          call.filters.push([key, value])
          return chain
        },
        order(key, value) {
          call.orders.push([key, value])
          return chain
        },
        range(from, to) {
          call.range = [from, to]
          return chain
        },
        then(resolve, reject) {
          return Promise.resolve({
            data: (options.rows?.[table] ?? []).slice(
              call.range[0],
              call.range[1] + 1,
            ),
            error: options.tableError,
          }).then(resolve, reject)
        },
      }
      return chain
    },
  }
  return {
    client,
    calls,
    repository: createClinicalRepository(client, {
      enabled: true,
      now: () => new Date('2026-01-12T12:00:00'),
    }),
  }
}
test('clinical preparation stays disabled by default, even with a real authenticated client', async () => {
  const f = fixture()
  await assert.rejects(
    createClinicalRepository(f.client).loadMine(),
    /não está liberada/,
  )
  await assert.rejects(
    createClinicalRepository(null, { enabled: true }).loadMine(),
  )
  assert.equal(f.calls.length, 0)
})
test('missing sessions and authentication failures never return demo data or issue queries', async () => {
  for (const option of [{ noSession: true }, { authError: Error('Expired') }]) {
    const f = fixture(option)
    await assert.rejects(f.repository.loadMine())
    assert.equal(f.calls.length, 0)
  }
})
test('clinical reads scope every paginated table to the authenticated patient and check access again', async () => {
  const f = fixture({
    rows: {
      glucose_readings: Array.from({ length: 501 }, (_, i) => ({
        id: String(i),
      })),
    },
  })
  const result = await f.repository.loadMine()
  assert.equal(result.records.length, 501)
  for (const call of f.calls.filter((call) => call.table)) {
    assert.deepEqual(call.filters, [['patient_id', patient]])
    assert.equal(call.orders[1][0], 'id')
    assert.equal(call.range[1] - call.range[0], 499)
  }
  assert.equal(
    f.calls.filter((call) => call.rpc === 'endo_clinical_overview').length,
    2,
  )
  assert.ok(
    f.calls
      .filter((call) => call.table === 'glucose_readings')
      .some((call) => call.range[0] === 500),
  )
})
test('authorization, table failures, malformed overview and account changes fail closed', async () => {
  for (const options of [
    { error: Error('Denied') },
    { tableError: Error('Offline') },
    { malformedOverview: true },
    { revokeAfterRead: true },
    { changeAccount: true },
  ]) {
    await assert.rejects(fixture(options).repository.loadMine())
  }
})
test('explicit consent cannot accept caller-forged patient IDs, flags or profession claims', async () => {
  const f = fixture()
  await assert.rejects(
    f.repository.grantActivation({
      doctor_id: doctor,
      request_id: request,
      confirmed: 'true',
    }),
  )
  assert.equal(f.calls.length, 0)
  await f.repository.grantActivation({
    doctor_id: doctor,
    request_id: request,
    confirmed: true,
    patient_id: doctor,
    verified: true,
  })
  assert.deepEqual(f.calls[0].args, {
    p_doctor_id: doctor,
    p_request_id: request,
    p_confirmed: true,
    p_actor_id: patient,
  })
  await f.repository.revokeActivation(doctor)
  assert.deepEqual(f.calls[1].args, {
    p_doctor_id: doctor,
    p_actor_id: patient,
  })
})
test('configuration carries the expected immutable version and request identity, not a caller doctor identity', async () => {
  const f = fixture()
  await f.repository.configure({
    patient_id: patient,
    module_key: 'diabetes',
    expected_version: null,
    request_id: request,
    doctor_id: patient,
    config: { low: '80', high: '180', patient_id: doctor },
  })
  assert.deepEqual(f.calls[0].args, {
    p_patient_id: patient,
    p_module_key: 'diabetes',
    p_expected_version: null,
    p_request_id: request,
    p_config: { low: 80, high: 180 },
    p_actor_id: patient,
  })
  await f.repository.closeModule({
    module_key: 'diabetes',
    expected_version: version,
    patient_id: doctor,
  })
  assert.deepEqual(f.calls[1].args, {
    p_module_key: 'diabetes',
    p_expected_version: version,
    p_actor_id: patient,
  })
})
test('record writes preserve units and instant/time zone and strip any supplied identity or snapshot', async () => {
  const f = fixture()
  const values = {
    occurred_at: '2026-01-10T08:00',
    value: '110',
    context: 'fasting',
    patient_id: doctor,
    plan_snapshot: { dose_mg: 99 },
  }
  await f.repository.saveRecord({
    kind: 'glucose',
    values,
    module_version_id: version,
    request_id: request,
  })
  const call = f.calls[0]
  assert.equal(call.rpc, 'endo_save_clinical_record')
  assert.equal(call.args.p_module_version, version)
  assert.equal(call.args.p_request_id, request)
  assert.equal(
    call.args.p_values.occurred_at,
    new Date(values.occurred_at).toISOString(),
  )
  assert.equal(
    call.args.p_values.time_zone,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  )
  assert.equal(call.args.p_values.value, 110)
  assert.equal('patient_id' in call.args.p_values, false)
  assert.equal('plan_snapshot' in call.args.p_values, false)
  assert.equal(values.value, '110')
})
test('corrections bind the verified actor and preserve the original instant and zone without accepting a new plan', async () => {
  const f = fixture()
  const instant = '2026-01-10T10:00:37.123Z'
  const original = {
    id: request,
    occurred_at: instant,
    time_zone: 'America/Sao_Paulo',
  }
  const local = new Date(instant)
  const time = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}T${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}`
  await f.repository.correctRecord({
    kind: 'glucose',
    record_id: request,
    request_id: version,
    reason: '  Erro de digitação ',
    original,
    values: {
      occurred_at: time,
      value: 120,
      context: 'fasting',
      patient_id: doctor,
      module_version_id: doctor,
    },
  })
  const call = f.calls[0]
  assert.equal(call.rpc, 'endo_correct_clinical_record')
  assert.equal(call.args.p_actor_id, patient)
  assert.equal(call.args.p_reason, 'Erro de digitação')
  assert.equal(call.args.p_values.occurred_at, instant)
  assert.equal(call.args.p_values.time_zone, original.time_zone)
  assert.equal(call.args.p_values.module_version_id, undefined)
  await assert.rejects(
    f.repository.voidRecord({
      kind: 'glucose',
      record_id: request,
      request_id: version,
      reason: 'Erro de registro',
      confirmed: false,
    }),
  )
  await f.repository.voidRecord({
    kind: 'glucose',
    record_id: request,
    request_id: version,
    reason: 'Erro de registro',
    confirmed: true,
  })
  assert.equal(f.calls[1].args.p_values, null)
})

test('invalid identifiers, kinds and values cannot issue writes; backend errors stay failures', async () => {
  const f = fixture()
  await assert.rejects(f.repository.loadPatient('demo-user'))
  await assert.rejects(
    f.repository.configure({
      patient_id: patient,
      module_key: 'not-a-module',
      expected_version: null,
      request_id: request,
      config: {},
    }),
  )
  await assert.rejects(
    f.repository.saveRecord({
      kind: 'glucose',
      values: {
        occurred_at: '2099-01-01T12:00',
        value: 100,
        context: 'fasting',
      },
      module_version_id: version,
      request_id: request,
    }),
  )
  assert.equal(f.calls.length, 0)
  await assert.rejects(
    fixture({ error: Error('Server rejected') }).repository.grantActivation({
      doctor_id: doctor,
      request_id: request,
      confirmed: true,
    }),
    /Server rejected/,
  )
})
