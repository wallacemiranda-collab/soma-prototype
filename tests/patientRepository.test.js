import test from 'node:test'
import assert from 'node:assert/strict'
import { createPatientRepository } from '../src/services/patientRepository.js'
import { localDate } from '../src/lib/patientData.js'

function fixture(
  user = { id: 'patient-a', email: 'example@example.invalid' },
  options = {},
) {
  const calls = []
  const client = {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from(table) {
      const call = { table, filters: [] }
      calls.push(call)
      const response = () => {
        const data =
          call.values ??
          (table === 'profiles'
            ? 'profile' in options
              ? options.profile
              : { id: user.id, full_name: 'Patient A' }
            : (options.rows?.[table] ?? []))
        return {
          data:
            Array.isArray(data) && call.range
              ? data.slice(call.range[0], call.range[1] + 1)
              : data,
          error: options.errors?.[table] ?? null,
        }
      }
      const query = {
        select() {
          return query
        },
        eq(key, value) {
          call.filters.push([key, value])
          return query
        },
        gte(key, value) {
          call.minimum = [key, value]
          return query
        },
        order(key, options) {
          call.orders = [...(call.orders ?? []), [key, options]]
          return query
        },
        range(from, to) {
          call.range = [from, to]
          return query
        },
        limit(value) {
          call.limit = value
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
  return { repository: createPatientRepository(client), client, calls }
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
    birth_date: '1992-02-29',
    sex: 'female',
    id: 'patient-b',
    email: 'another@example.invalid',
  })
  assert.equal(calls[0].values.user_id, 'patient-a')
  assert.equal(calls[0].values.value, 0)
  assert.equal(calls[0].options.onConflict, 'user_id,logged_at,habit_key')
  assert.equal(calls[1].values.id, 'patient-a')
  assert.equal(calls[1].values.birth_date, '1992-02-29')
  assert.equal(calls[1].values.sex, 'female')
  assert.equal('email' in calls[1].values, false)
  await assert.rejects(repository.saveHabit(localDate(), 'invalid', true))
})

test('database load errors never fall back to synthetic records', async () => {
  const error = new Error('Backend unavailable')
  for (const table of ['profiles', 'metabolic_entries', 'habit_logs']) {
    const { repository } = fixture(undefined, { errors: { [table]: error } })
    await assert.rejects(repository.load(), (failure) => failure === error)
  }
})

test('failed writes propagate the error and preserve caller input', async () => {
  const error = new Error('Write failed')
  const { repository } = fixture(undefined, {
    errors: {
      metabolic_entries: error,
      habit_logs: error,
      profiles: error,
    },
  })
  const values = { entry_date: localDate(), weight_kg: '82,4' }
  await assert.rejects(
    repository.saveEntry(values),
    (failure) => failure === error,
  )
  assert.deepEqual(values, { entry_date: localDate(), weight_kg: '82,4' })
  await assert.rejects(
    repository.saveHabit(localDate(), 'sleep', true),
    (failure) => failure === error,
  )
  await assert.rejects(
    repository.saveProfile({ full_name: 'Patient' }),
    (failure) => failure === error,
  )
})

test('old authenticated accounts create only their own missing profile', async () => {
  const { repository, calls } = fixture(
    { id: 'old-patient', email: 'old@example.invalid' },
    { profile: null },
  )
  const data = await repository.load()
  assert.equal(data.profile.id, 'old-patient')
  assert.equal(data.profile.full_name, 'old')
  assert.equal(calls[3].values.id, 'old-patient')
  assert.equal(calls[3].options.onConflict, 'id')
})

test('history reads use bounded pages and reject an expired authenticated session', async () => {
  const { repository, client, calls } = fixture()
  await repository.load()
  assert.deepEqual(calls[1].range, [0, 499])
  assert.deepEqual(calls[2].range, [0, 499])
  assert.deepEqual(calls[1].orders[0], ['entry_date', { ascending: false }])
  assert.deepEqual(calls[1].orders[1], ['id', { ascending: false }])
  client.auth.getUser = async () => ({
    data: { user: { id: 'patient-a' } },
    error: new Error('Expired'),
  })
  calls.length = 0
  await assert.rejects(repository.load())
  assert.equal(calls.length, 0)
})

test('all historical records are accessible beyond one API page or one year', async () => {
  const entries = Array.from({ length: 501 }, (_, index) => ({
    id: `entry-${index}`,
    entry_date: '2020-01-01',
    weight_kg: 80,
  }))
  const { repository, calls } = fixture(undefined, {
    rows: { metabolic_entries: entries },
  })
  const data = await repository.load()
  assert.equal(data.entries.length, 501)
  const reads = calls.filter((call) => call.table === 'metabolic_entries')
  assert.deepEqual(
    reads.map((call) => call.range),
    [
      [0, 499],
      [500, 999],
    ],
  )
  assert.ok(reads.every((call) => call.minimum === undefined))
})

test('invalid personal details cannot issue a profile write', async () => {
  const { repository, calls } = fixture()
  await assert.rejects(
    repository.saveProfile({ full_name: 'Patient', birth_date: '2025-02-29' }),
    /Data de nascimento/,
  )
  await assert.rejects(
    repository.saveProfile({ full_name: 'Patient', sex: 'invalid' }),
    /Sexo/,
  )
  assert.equal(calls.length, 0)
})

test('height and reference writes keep ownership and reject invalid values before accessing the backend', async () => {
  const { repository, calls } = fixture()
  await repository.saveProfile({
    full_name: 'Patient A',
    height_cm: '175',
    id: 'patient-b',
  })
  assert.equal(calls[0].values.height_cm, 175)
  assert.equal(calls[0].values.id, 'patient-a')
  await repository.saveEntry({
    entry_date: localDate(),
    weight_kg: 70,
    height_cm: 175,
    user_id: 'patient-b',
  })
  assert.equal(calls[1].values.height_cm, 175)
  assert.equal(calls[1].values.user_id, 'patient-a')
  calls.length = 0
  await assert.rejects(
    repository.saveProfile({ full_name: 'Patient A', height_cm: 0 }),
  )
  await assert.rejects(
    repository.saveEntry({
      entry_date: localDate(),
      weight_kg: 70,
      height_cm: 0,
    }),
  )
  assert.deepEqual(calls, [])
})
