import test from 'node:test'
import assert from 'node:assert/strict'
import { createCalculatorRepository } from '../src/services/calculatorRepository.js'

const patient = '11111111-1111-4111-8111-111111111111'
const doctor = '22222222-2222-4222-8222-222222222222'
const resultId = '33333333-3333-4333-8333-333333333333'
const inputs = {
  age_years: 45,
  ast_u_l: 110,
  alt_u_l: 100,
  platelets_10e9_l: 99,
  test_date: '2026-05-10',
}

function fixture(options = {}) {
  const calls = []
  let authCalls = 0
  const client = {
    auth: {
      async getUser() {
        authCalls++
        return {
          data: {
            user: options.noSession
              ? null
              : { id: options.changeAccount && authCalls > 1 ? patient : doctor },
          },
          error: options.authError,
        }
      },
    },
    async rpc(name, args) {
      calls.push({ name, args })
      return {
        data: Object.hasOwn(options, 'data')
          ? options.data
          : name === 'endo_doctor_calculator_results'
            ? []
            : { id: resultId, shared_with_patient: false },
        error: options.error,
      }
    },
  }
  return {
    calls,
    repository: createCalculatorRepository(client, {
      enabled: options.enabled ?? true,
      now: () => new Date('2026-11-23T12:00:00Z'),
    }),
  }
}

test('doctor result writes carry only validated inputs and a server request identity', async () => {
  const f = fixture()
  await f.repository.saveDoctorFib4(patient, inputs)
  const call = f.calls[0]
  assert.equal(call.name, 'endo_save_fib4_result')
  assert.equal(call.args.p_patient_id, patient)
  assert.equal(call.args.p_age_years, 45)
  assert.equal(call.args.p_ast_u_l, 110)
  assert.match(call.args.p_access_request_id, /^[0-9a-f-]{36}$/)
  assert.equal(Object.hasOwn(call.args, 'p_result'), false)
})

test('doctor history uses the audited RPC with one request identity', async () => {
  const f = fixture({ data: [] })
  assert.deepEqual(await f.repository.listForDoctor(patient), [])
  assert.equal(f.calls[0].name, 'endo_doctor_calculator_results')
  assert.equal(f.calls[0].args.p_patient_id, patient)
  assert.match(f.calls[0].args.p_access_request_id, /^[0-9a-f-]{36}$/)
})

test('patient visibility is an explicit per-result RPC action', async () => {
  const f = fixture({
    data: { id: resultId, shared_with_patient: true, inputs: { ast_u_l: 999 } },
  })
  assert.deepEqual(await f.repository.setPatientVisibility(resultId, true), {
    id: resultId,
    shared_with_patient: true,
  })
  assert.deepEqual(f.calls[0], {
    name: 'endo_set_calculator_result_visibility',
    args: { p_result_id: resultId, p_shared_with_patient: true },
  })
  await assert.rejects(f.repository.setPatientVisibility(resultId, 'true'))
  assert.equal(f.calls.length, 1)
})

test('patient history never accepts a caller-selected patient ID', async () => {
  const f = fixture({ data: [] })
  assert.deepEqual(await f.repository.listForPatient(), [])
  assert.deepEqual(f.calls[0], {
    name: 'endo_patient_calculator_results',
    args: { p_offset: 0, p_limit: 100 },
  })
})

test('disabled, unauthenticated, malformed, failed and changed-account operations fail closed', async () => {
  await assert.rejects(fixture({ enabled: false }).repository.listForPatient())
  for (const options of [
    { noSession: true },
    { authError: Error('Expired') },
    { error: Error('Denied') },
    { changeAccount: true },
    { data: null },
  ]) {
    const f = fixture(options)
    await assert.rejects(f.repository.listForDoctor(patient))
  }
  const malformed = fixture({ data: {} })
  await assert.rejects(malformed.repository.listForDoctor(patient))
  const invalid = fixture()
  await assert.rejects(invalid.repository.saveDoctorFib4('not-a-uuid', inputs))
  await assert.rejects(
    invalid.repository.saveDoctorFib4(patient, { ...inputs, ast_u_l: 0 }),
  )
  assert.equal(invalid.calls.length, 0)
})
