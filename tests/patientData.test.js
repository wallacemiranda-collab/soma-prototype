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

test('all measurements enforce their limits and integer fields reject fractions', () => {
  const bounds = {
    weight_kg: [0.1, 800],
    waist_cm: [1, 500],
    sleep_minutes: [0, 1440],
    activity_minutes: [0, 1440],
    water_liters: [0, 30],
    mood_score: [1, 10],
  }
  for (const [field, [min, max]] of Object.entries(bounds)) {
    for (const value of [min, max])
      assert.equal(
        validateEntry({ entry_date: localDate(), [field]: value })[field],
        value,
      )
    for (const value of [min - 1, max + 1, 'abc', {}, NaN])
      assert.throws(() =>
        validateEntry({ entry_date: localDate(), [field]: value }),
      )
  }
  for (const field of ['sleep_minutes', 'activity_minutes', 'mood_score']) {
    assert.throws(() =>
      validateEntry({ entry_date: localDate(), [field]: 1.5 }),
    )
  }
})

test('optional goals preserve null and zero without inventing clinical targets', () => {
  const profile = validateProfile({
    full_name: '  Patient  ',
    goal_weight: '',
    weekly_exercise_goal: '0',
    sleep_goal_hours: '0',
    id: 'other',
  })
  assert.deepEqual(profile, {
    full_name: 'Patient',
    goal_weight: null,
    weekly_exercise_goal: 0,
    sleep_goal_hours: 0,
  })
  assert.throws(() => validateProfile({ full_name: 'A'.repeat(101) }))
  assert.throws(() =>
    validateProfile({ full_name: 'Patient', weekly_exercise_goal: 1.5 }),
  )
  assert.throws(() =>
    validateProfile({ full_name: 'Patient', sleep_goal_hours: 25 }),
  )
})

test('calendar validation handles leap years and rejects malformed or non-string dates', () => {
  assert.equal(validateDate('2024-02-29', '2024-03-01'), '2024-02-29')
  for (const date of [
    '2025-02-29',
    '2026-13-01',
    '2026-00-01',
    '2026-01-00',
    '2026-1-1',
    '',
    null,
    20260101,
  ]) {
    assert.throws(() => validateDate(date, '2026-12-31'))
  }
})
