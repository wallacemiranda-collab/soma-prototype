import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createReminderPreviewStore,
  emptyReminderPreview,
  isQuietTime,
  reminderPreviewKey,
  simulateReminderPreview,
  validateReminderPreview,
} from '../src/lib/reminderPreview.js'

function enabled() {
  const value = emptyReminderPreview()
  value.enabled = true
  value.rules.forEach((rule) => {
    rule.enabled = true
  })
  return value
}
test('reminders are disabled initially and schedules are explicit, never treatment instructions', () => {
  const initial = emptyReminderPreview()
  assert.equal(initial.enabled, false)
  assert.ok(initial.rules.every((row) => !row.enabled))
  assert.deepEqual(
    simulateReminderPreview(initial, { time: '08:00', weekday: 1 }),
    { status: 'disabled', labels: [] },
  )
  const state = enabled()
  assert.deepEqual(
    simulateReminderPreview(state, { time: '08:00', weekday: 1 }).labels,
    ['Medicação (exemplo)', 'Pesagem semanal'],
  )
  assert.deepEqual(
    simulateReminderPreview(state, { time: '08:00', weekday: 2 }).labels,
    ['Medicação (exemplo)'],
  )
  assert.equal(
    simulateReminderPreview(state, { time: '09:00', weekday: 2 }).status,
    'empty',
  )
  assert.deepEqual(
    simulateReminderPreview(state, { time: '09:00', weekday: 1 }).labels,
    ['Aplicação semanal (exemplo)'],
  )
  assert.equal(
    simulateReminderPreview(state, { time: '20:00', weekday: 0 }).status,
    'due',
  )
})
test('quiet time is half-open, crosses midnight and does not postpone medication', () => {
  const quiet = emptyReminderPreview().quiet
  for (const time of ['22:00', '23:59', '00:00', '07:59'])
    assert.equal(isQuietTime(quiet, time), true)
  for (const time of ['08:00', '21:59'])
    assert.equal(isQuietTime(quiet, time), false)
  assert.equal(
    isQuietTime({ enabled: true, start: '12:00', end: '14:00' }, '13:00'),
    true,
  )
  assert.equal(isQuietTime({ ...quiet, enabled: false }, '23:00'), false)
  const state = enabled()
  state.rules[0].time = '23:00'
  assert.equal(
    simulateReminderPreview(state, { time: '23:00', weekday: 1 }).status,
    'quiet',
  )
  assert.deepEqual(
    simulateReminderPreview(state, { time: '08:00', weekday: 2 }).labels,
    [],
  )
})
test('malformed schedules, duplicate rules, zones and equal quiet bounds fail closed', () => {
  for (const value of ['24:00', '12:60', '8:00', '', null, '00:00<script>']) {
    const state = enabled()
    state.rules[0].time = value
    assert.throws(() => validateReminderPreview(state))
  }
  for (const weekday of [-1, 7, 1.5, '1', null]) {
    const state = enabled()
    state.rules[1].weekday = weekday
    assert.throws(() => validateReminderPreview(state))
  }
  const equal = enabled()
  equal.quiet.end = equal.quiet.start
  assert.throws(() => validateReminderPreview(equal), /diferentes/)
  const duplicate = enabled()
  duplicate.rules[1] = duplicate.rules[0]
  assert.throws(() => validateReminderPreview(duplicate))
  const zone = enabled()
  zone.timeZone = 'Unknown/Fake'
  assert.throws(() => validateReminderPreview(zone))
  assert.equal(
    emptyReminderPreview('Unknown/Fake').timeZone,
    'America/Sao_Paulo',
  )
})
test('only validated fictitious preferences survive reload, with copies and bounded input', () => {
  const map = new Map(),
    storage = {
      getItem: (key) => map.get(key) ?? null,
      setItem: (key, value) => map.set(key, value),
      removeItem: (key) => map.delete(key),
    }
  const store = createReminderPreviewStore(storage)
  const original = enabled()
  original.patientEmail = 'must-not-be-saved@example.invalid'
  store.save(original)
  original.rules[0].time = '15:00'
  assert.equal(store.read().rules[0].time, '08:00')
  assert.ok(!map.get(reminderPreviewKey).includes('must-not-be-saved'))
  assert.equal(createReminderPreviewStore(storage).read().enabled, true)
  store.clear()
  assert.equal(createReminderPreviewStore(storage).read().enabled, false)
  for (const raw of [
    '{',
    '{}',
    'x'.repeat(5001),
    JSON.stringify({ version: 9, mode: 'reminders-demo', data: enabled() }),
  ]) {
    map.set(reminderPreviewKey, raw)
    assert.equal(createReminderPreviewStore(storage).read().enabled, false)
    assert.equal(map.has(reminderPreviewKey), false)
  }
})
test('blocked or full storage retains only a memory simulation and clears stale preferences', () => {
  const broken = {
    getItem() {
      throw new Error('blocked')
    },
    setItem() {
      throw new Error('blocked')
    },
    removeItem() {
      throw new Error('blocked')
    },
  }
  const store = createReminderPreviewStore(broken)
  assert.equal(store.read().enabled, false)
  store.save(enabled())
  assert.equal(store.isPersistent(), false)
  assert.equal(store.read().enabled, true)
  store.clear()
  assert.equal(store.read().enabled, false)
  let removed = false
  const full = createReminderPreviewStore({
    getItem: () => null,
    setItem() {
      throw new Error('quota')
    },
    removeItem() {
      removed = true
    },
  })
  full.save(enabled())
  assert.equal(full.isPersistent(), false)
  assert.equal(removed, true)
})
