import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeDoctorCode,
  sharingStatus,
  validateDoctorProfile,
  validateSharing,
} from '../src/lib/sharing.js'
import { createSharingRepository } from '../src/services/sharingRepository.js'

const doctorId = 'db3f8eb5-0611-48c7-b24d-4c2618222f8e'
const patientId = 'f131fb47-3bd6-4c06-84aa-3774272b68db'
const doctor = {
  professional_name: 'Dra. Teste',
  crm: '12345',
  crm_state: 'SP',
  confirmed: true,
}

function fixture(options = {}) {
  const calls = []
  const client = {
    auth: {
      getUser: async () => ({
        data: {
          user: options.noSession
            ? null
            : { id: doctorId, user_metadata: { role: 'admin' } },
        },
      }),
    },
    async rpc(name, params) {
      calls.push({ name, params })
      return {
        data:
          name === 'endo_can_read_patient'
            ? options.allowed !== false
            : name === 'endo_shared_profile'
              ? (options.profiles ?? [{ id: patientId, full_name: 'Patient' }])
              : [],
        error: options.error ?? null,
      }
    },
    from(table) {
      const call = { table, filters: [] }
      calls.push(call)
      const query = {
        select() {
          return query
        },
        eq(key, value) {
          call.filters.push([key, value])
          return query
        },
        order() {
          return query
        },
        range() {
          return query
        },
        insert(values) {
          call.values = values
          return query
        },
        update(values) {
          call.values = values
          call.method = 'PATCH'
          return query
        },
        async single() {
          return { data: call.values, error: options.error }
        },
        async maybeSingle() {
          return { data: null, error: options.error }
        },
        then(resolve, reject) {
          return Promise.resolve({ data: [], error: options.error }).then(
            resolve,
            reject,
          )
        },
      }
      return query
    },
  }
  return { repository: createSharingRepository(client), calls }
}

test('professional registration validates CRM format and requires a declaration, not an invented verification', () => {
  assert.deepEqual(validateDoctorProfile(doctor), {
    professional_name: 'Dra. Teste',
    crm: '12345',
    crm_state: 'SP',
  })
  for (const changes of [
    { confirmed: false },
    { crm: 'ABC' },
    { crm_state: 'ZZ' },
    { professional_name: '' },
  ])
    assert.throws(() => validateDoctorProfile({ ...doctor, ...changes }))
  assert.equal(
    'verified' in validateDoctorProfile({ ...doctor, verified: true }),
    false,
  )
})

test('doctor lookup uses an exact normalized code rather than a directory of patients or emails', () => {
  assert.equal(normalizeDoctorCode(' abcd-1234-efab-5678 '), 'ABCD1234EFAB5678')
  assert.equal(normalizeDoctorCode(' dr-wallace '), 'DRWALLACE')
  assert.equal(normalizeDoctorCode('clinica 123'), 'CLINICA123')
  assert.equal(normalizeDoctorCode('A'.repeat(24)), 'A'.repeat(24))
  for (const value of [
    '',
    'someone@example.invalid',
    null,
    {},
    'ABCD',
    'DRJOÃO',
    'A'.repeat(25),
    'DR_TESTE',
  ])
    assert.throws(() => normalizeDoctorCode(value))
})

test('code customization changes only the authenticated doctor code', async () => {
  const { repository, calls } = fixture()
  await repository.updateDoctorCode(' dr-wallace ')
  assert.deepEqual(calls[0], {
    table: 'doctor_profiles',
    filters: [['user_id', doctorId]],
    method: 'PATCH',
    values: { share_code: 'DRWALLACE' },
  })
})

test('invalid codes and expired sessions never issue a code update', async () => {
  const { repository, calls } = fixture()
  await assert.rejects(repository.updateDoctorCode('abc'), /6 a 24/)
  assert.deepEqual(calls, [])
  const missing = fixture({ noSession: true })
  await assert.rejects(missing.repository.updateDoctorCode('DRWALLACE'))
  assert.deepEqual(missing.calls, [])
  await assert.rejects(
    createSharingRepository(null).updateDoctorCode('DRWALLACE'),
  )
})

test('duplicate or reserved codes have a useful error and network failures propagate', async () => {
  await assert.rejects(
    fixture({ error: { code: '23505' } }).repository.updateDoctorCode(
      'DRWALLACE',
    ),
    /não está disponível/,
  )
  const error = new Error('Synthetic connection failure')
  await assert.rejects(
    fixture({ error }).repository.updateDoctorCode('DRWALLACE'),
    (failure) => failure === error,
  )
})

test('sharing requires explicit consent and a supported duration', () => {
  for (const days of [7, 30, 90, '30', null, ''])
    assert.equal(
      validateSharing({ doctor_id: doctorId, confirmed: true, days }).p_days,
      days === null || days === '' ? null : Number(days),
    )
  for (const changes of [
    { doctor_id: 'invalid' },
    { confirmed: false },
    { days: -1 },
    { days: 365 },
    { days: undefined },
  ])
    assert.throws(() =>
      validateSharing({
        doctor_id: doctorId,
        confirmed: true,
        days: 30,
        ...changes,
      }),
    )
})

test('revocation and expiry take precedence over active access', () => {
  const now = Date.parse('2026-11-21T12:00:00Z')
  assert.equal(
    sharingStatus({ expires_at: '2026-11-21T12:00:00Z' }, now),
    'Expirado',
  )
  assert.equal(sharingStatus({ expires_at: null }, now), 'Ativo')
  assert.equal(
    sharingStatus({ revoked_at: '2026-11-20T12:00:00Z' }, now),
    'Revogado',
  )
})

test('sharing repository fails closed without backend or authenticated user', async () => {
  await assert.rejects(createSharingRepository(null).listPatients())
  const { repository, calls } = fixture({ noSession: true })
  await assert.rejects(repository.listDoctors())
  assert.deepEqual(calls, [])
})

test('caller-controlled identity and verification fields never enter professional writes', async () => {
  const { repository, calls } = fixture()
  await repository.registerDoctor({
    ...doctor,
    user_id: patientId,
    verified: true,
    share_code: 'chosen-code',
  })
  assert.deepEqual(calls[0].values, {
    professional_name: 'Dra. Teste',
    crm: '12345',
    crm_state: 'SP',
    user_id: doctorId,
  })
})

test('grant and revoke RPCs cannot accept a forged patient identity', async () => {
  const { repository, calls } = fixture()
  await repository.grant({
    doctor_id: doctorId,
    patient_id: patientId,
    days: '30',
    confirmed: true,
  })
  await repository.revoke(doctorId)
  assert.deepEqual(calls[0], {
    name: 'endo_grant_doctor_access',
    params: { p_doctor_id: doctorId, p_days: 30 },
  })
  assert.deepEqual(calls[1], {
    name: 'endo_revoke_doctor_access',
    params: { p_doctor_id: doctorId },
  })
})

test('shared reads are scoped to the requested patient and recheck authorization before returning data', async () => {
  const { repository, calls } = fixture()
  const data = await repository.loadPatient(patientId)
  assert.equal(data.profile.id, patientId)
  for (const call of calls.filter((call) => call.table))
    assert.deepEqual(call.filters, [['user_id', patientId]])
  assert.equal(calls.at(-1).name, 'endo_can_read_patient')
  await assert.rejects(
    fixture({ allowed: false }).repository.loadPatient(patientId),
    /Acesso/,
  )
  const empty = fixture({ profiles: [] })
  await assert.rejects(empty.repository.loadPatient(patientId))
  assert.equal(
    empty.calls.some((call) => call.table),
    false,
  )
})

test('RPC and table failures never produce successful grants or patient data', async () => {
  const error = new Error('Synthetic backend failure')
  const { repository } = fixture({ error })
  await assert.rejects(
    repository.grant({ doctor_id: doctorId, days: 30, confirmed: true }),
    (failure) => failure === error,
  )
  await assert.rejects(
    repository.loadPatient(patientId),
    (failure) => failure === error,
  )
})
