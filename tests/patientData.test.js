import test from 'node:test'
import assert from 'node:assert/strict'
import {
  dateBefore,
  habitsForDate,
  localDate,
  optionalNumber,
  validateDate,
  validateEntry,
  validateProfile,
  weeklyHabitProgress,
} from '../src/lib/patientData.js'
import { readBackendConfig } from '../src/lib/backendConfig.js'

test('calendar dates stay local, including month boundaries', () => {
  const date = new Date(2026, 2, 1, 0, 5)
  assert.equal(localDate(date), '2026-03-01')
  assert.equal(dateBefore(1, date), '2026-02-28')
  assert.throws(() => validateDate('2026-02-30', '2026-03-01'))
  assert.throws(() => validateDate('2026-03-02', '2026-03-01'))
})

test('blank measurements are null, zero activity is a valid record', () => {
  const entry = validateEntry({
    entry_date: localDate(),
    activity_minutes: '0',
    weight_kg: '',
  })
  assert.equal(entry.weight_kg, null)
  assert.equal(entry.activity_minutes, 0)
  assert.throws(() =>
    validateEntry({ entry_date: localDate(), weight_kg: '   ' }),
  )
  assert.equal(optionalNumber('82,4', 1, 800, 'Peso'), 82.4)
})

test('invalid, fractional and injected fields cannot become patient records', () => {
  for (const activity_minutes of ['NaN', Infinity, true, '-1', '1.5', '1441'])
    assert.throws(() =>
      validateEntry({ entry_date: localDate(), activity_minutes }),
    )
  const entry = validateEntry({
    entry_date: localDate(),
    weight_kg: 80,
    user_id: 'other-user',
    id: 'other-record',
  })
  assert.equal('user_id' in entry, false)
  assert.equal('id' in entry, false)
  assert.throws(() => validateProfile({ full_name: ' ' }))
  assert.equal(
    validateProfile({ full_name: '  Ana Souza  ' }).full_name,
    'Ana Souza',
  )
})

test('habit completion is isolated by calendar date and never double-counts a key', () => {
  const today = localDate()
  const logs = [
    { logged_at: today, habit_key: 'sleep', value: 1 },
    { logged_at: today, habit_key: 'sleep', value: 1 },
    { logged_at: dateBefore(1), habit_key: 'movement', value: 1 },
  ]
  assert.equal(
    habitsForDate(logs, today).filter((habit) => habit.done).length,
    1,
  )
  assert.equal(weeklyHabitProgress(logs).at(-1).value, 25)
  assert.equal(weeklyHabitProgress(logs).length, 7)
})

test('backend configuration fails closed and rejects private service keys', () => {
  const env = {
    VITE_SUPABASE_URL: 'https://project.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'sb_publishable_example',
  }
  assert.equal(readBackendConfig(env).configured, true)
  assert.equal(readBackendConfig({}).configured, false)
  assert.equal(
    readBackendConfig({ ...env, VITE_SUPABASE_ANON_KEY: 'sb_secret_example' })
      .configured,
    false,
  )
  const token = (role) =>
    `header.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`
  assert.equal(
    readBackendConfig({ ...env, VITE_SUPABASE_ANON_KEY: token('service_role') })
      .configured,
    false,
  )
  assert.equal(
    readBackendConfig({ ...env, VITE_SUPABASE_ANON_KEY: token('anon') })
      .configured,
    true,
  )
})
