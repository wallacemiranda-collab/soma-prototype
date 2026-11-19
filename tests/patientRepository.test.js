import test from 'node:test'
import assert from 'node:assert/strict'
import { createPatientRepository } from '../src/services/patientRepository.js'
import { localDate } from '../src/lib/patientData.js'

function fixture(user = { id: 'patient-a', email: 'example@example.invalid' }) {
  const calls = []
  const client = {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from(table) {
      const call = { table, filters: [] }
      calls.push(call)
      const response = () => ({
        data:
          call.values ??
          (table === 'profiles' ? { id: user.id, full_name: 'Patient A' } : []),
        error: null,
      })
      const query = {
        select() {
          return query
        },
        eq(key, value) {
          call.filters.push([key, value])
          return query
        },
        gte() {
          return query
        },
        order() {
          return query
        },
        limit() {
          return query
        },
        upsert(values, options) {
          call.values = values
          call.options = options
          return query
        },
        maybeSingle: async () => response(),
        single: async () => response(),
        then(resolve, reject) {
          return Promise.resolve(response()).then(resolve, reject)
        },
      }
      return query
    },
  }
  return { repository: createPatientRepository(client), calls }
}

test('missing backend or session never grants access or issues data queries', async () => {
  await assert.rejects(createPatientRepository(null).load())
  const { repository, calls } = fixture(null)
  await assert.rejects(repository.load())
  assert.equal(calls.length, 0)
})

test('every patient read is explicitly scoped to the authenticated identity', async () => {
  const { repository, calls } = fixture()
  await repository.load()
  assert.deepEqual(
    calls.map(({ table, filters }) => [table, filters]),
    [
      ['profiles', [['id', 'patient-a']]],
      ['metabolic_entries', [['user_id', 'patient-a']]],
      ['habit_logs', [['user_id', 'patient-a']]],
    ],
  )
})

test('measurements ignore caller identity and update one row per patient per day', async () => {
  const { repository, calls } = fixture()
  await repository.saveEntry({
    entry_date: localDate(),
    weight_kg: 80,
    user_id: 'patient-b',
  })
  assert.equal(calls[0].values.user_id, 'patient-a')
  assert.equal(calls[0].options.onConflict, 'user_id,entry_date')
})

test('habit and profile writes cannot target another patient', async () => {
  const { repository, calls } = fixture()
  await repository.saveHabit(localDate(), 'sleep', false)
  await repository.saveProfile({
    full_name: 'Patient A',
    id: 'patient-b',
    email: 'another@example.invalid',
  })
  assert.equal(calls[0].values.user_id, 'patient-a')
  assert.equal(calls[0].values.value, 0)
  assert.equal(calls[0].options.onConflict, 'user_id,logged_at,habit_key')
  assert.equal(calls[1].values.id, 'patient-a')
  assert.equal('email' in calls[1].values, false)
  await assert.rejects(repository.saveHabit(localDate(), 'invalid', true))
})
