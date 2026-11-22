import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addCalendarDays,
  exampleRecords,
  measurementsInRange,
  nextApplication,
  validateClinicalRecord,
  validateModuleConfig,
} from '../src/lib/clinicalModules.js'
import {
  appendClinicalRecord,
  changeClinicalPermission,
  closeClinicalModule,
  configureClinicalModule,
  createClinicalPreviewStore,
  emptyClinicalPreview,
} from '../src/lib/clinicalPreviewStore.js'

const doctor = 'demo-doctor-a'
const other = 'demo-doctor-b'
const now = new Date('2026-01-12T12:00:00')
const date = '2026-01-10T08:00'
const config = {
  medication: 'Semaglutida',
  dose_mg: 1,
  interval_days: 7,
  anchor_date: '2026-01-01',
}
function active(moduleId, values = {}) {
  return configureClinicalModule(
    changeClinicalPermission(emptyClinicalPreview(), doctor, true),
    doctor,
    moduleId,
    values,
  )
}

test('module activation requires a separate explicit permission, not a navigation role', () => {
  const state = emptyClinicalPreview()
  assert.throws(
    () => configureClinicalModule(state, doctor, 'thyroid'),
    /autorizar/,
  )
  assert.throws(
    () => configureClinicalModule(state, 'doctor', 'thyroid'),
    /autorizar/,
  )
  assert.throws(() => changeClinicalPermission(state, doctor, 'true'))
  assert.throws(
    () =>
      appendClinicalRecord(
        state,
        'thyroid',
        { occurred_at: date, fasting: 'yes' },
        'one',
        now,
      ),
    /não está ativo/,
  )
})
test('revocation blocks new records, preserves history and renewal never reactivates a prior configuration', () => {
  let state = appendClinicalRecord(
    active('thyroid'),
    'thyroid',
    { occurred_at: date, fasting: 'yes' },
    'one',
    now,
  )
  state = changeClinicalPermission(state, doctor, false)
  assert.equal(state.records.length, 1)
  assert.throws(() =>
    appendClinicalRecord(
      state,
      'thyroid',
      { occurred_at: date, fasting: 'yes' },
      'two',
      now,
    ),
  )
  state = changeClinicalPermission(state, doctor, true)
  assert.throws(() =>
    appendClinicalRecord(
      state,
      'thyroid',
      { occurred_at: date, fasting: 'yes' },
      'two',
      now,
    ),
  )
  state = configureClinicalModule(state, doctor, 'thyroid')
  assert.equal(
    appendClinicalRecord(
      state,
      'thyroid',
      { occurred_at: date, fasting: 'yes' },
      'two',
      now,
    ).records.length,
    2,
  )
})
test('a second authorized physician cannot overwrite an owned module; the patient can close and transfer it', () => {
  let state = changeClinicalPermission(active('thyroid'), other, true)
  assert.throws(
    () => configureClinicalModule(state, other, 'thyroid'),
    /Outro médico/,
  )
  state = configureClinicalModule(state, other, 'pressure')
  state = changeClinicalPermission(state, doctor, false)
  assert.equal(state.modules.pressure.doctorId, other)
  state = closeClinicalModule(state, 'thyroid')
  state = configureClinicalModule(state, other, 'thyroid')
  assert.equal(state.modules.thyroid.doctorId, other)
  assert.equal(state.modules.thyroid.revision, 2)
})
test('capillary proportion counts recorded samples inclusively, not hours, and filters context', () => {
  const rows = [80, 100, 180, 200].map((value, i) => ({
    kind: 'glucose',
    value,
    context: i % 2 ? 'other' : 'fasting',
  }))
  assert.deepEqual(measurementsInRange(rows, { low: 80, high: 180 }), {
    inside: 3,
    total: 4,
    percent: 75,
  })
  assert.deepEqual(
    measurementsInRange(rows, { low: 80, high: 180 }, 'fasting'),
    { inside: 2, total: 2, percent: 100 },
  )
  for (const range of [
    null,
    {},
    { low: 180, high: 80 },
    { low: NaN, high: 180 },
  ])
    assert.equal(measurementsInRange(rows, range), null)
  assert.equal(measurementsInRange([], { low: 80, high: 180 }), null)
})
test('range and injectable configuration have no invented target, dose or frequency', () => {
  assert.deepEqual(validateModuleConfig('diabetes'), { low: null, high: null })
  assert.throws(() => validateModuleConfig('diabetes', { low: 80 }))
  assert.throws(() => validateModuleConfig('diabetes', { low: 180, high: 80 }))
  assert.throws(() => validateModuleConfig('glp1', {}))
  assert.throws(() =>
    validateModuleConfig('glp1', { ...config, interval_days: 1.5 }),
  )
  assert.throws(() =>
    validateModuleConfig('glp1', { ...config, anchor_date: '2026-02-30' }),
  )
  assert.deepEqual(
    validateModuleConfig('glp1', { ...config, user_id: 'forged' }),
    config,
  )
})
test('calendar schedule respects leap years and month boundaries and never turns an overdue date into dosing advice', () => {
  assert.equal(addCalendarDays('2024-02-28', 1), '2024-02-29')
  assert.equal(addCalendarDays('2026-12-28', 7), '2027-01-04')
  const state = active('glp1', config)
  assert.equal(nextApplication(state.modules.glp1, []), '2026-01-01')
  const withRecord = appendClinicalRecord(
    state,
    'injection',
    { occurred_at: date, site: 'abdomen' },
    'one',
    now,
  )
  assert.equal(
    nextApplication(withRecord.modules.glp1, withRecord.records),
    '2026-01-17',
  )
})
test('new treatment versions cannot rewrite past medication/dose snapshots or reuse old application dates', () => {
  let state = appendClinicalRecord(
    active('glp1', config),
    'injection',
    { occurred_at: date, site: 'thigh' },
    'one',
    now,
  )
  state = configureClinicalModule(state, doctor, 'glp1', {
    ...config,
    dose_mg: 2,
    anchor_date: '2026-01-20',
  })
  assert.equal(state.records[0].plan_snapshot.dose_mg, 1)
  assert.throws(() => appendClinicalRecord(state, 'injection', { occurred_at: date, site: 'thigh' }, 'older-dose', now), /anterior/)
  assert.equal(nextApplication(state.modules.glp1, state.records), '2026-01-20')
})
test('every clinical record rejects invalid time, future values, unlisted contexts and forged fields', () => {
  for (const occurred_at of [
    '2026-02-30T10:00',
    '2026-01-10T25:00',
    '2026-01-13T08:00',
    '2026-01-10T08:00Z',
  ])
    assert.throws(() =>
      validateClinicalRecord(
        'glucose',
        { occurred_at, value: 100, context: 'fasting' },
        now,
      ),
    )
  assert.throws(() =>
    validateClinicalRecord(
      'glucose',
      { occurred_at: date, value: NaN, context: 'fasting' },
      now,
    ),
  )
  assert.throws(() =>
    validateClinicalRecord(
      'glucose',
      { occurred_at: date, value: 100, context: 'unknown' },
      now,
    ),
  )
  assert.deepEqual(
    validateClinicalRecord(
      'glucose',
      {
        occurred_at: date,
        value: '100',
        context: 'fasting',
        user_id: 'forged',
        doctor_id: doctor,
      },
      now,
    ),
    { kind: 'glucose', occurred_at: date, value: 100, context: 'fasting' },
  )
})
test('hypoglycemia is a reported episode, HbA1c has its own date, GI accepts only 0..3, and fasting is not inferred', () => {
  assert.equal(
    validateClinicalRecord(
      'hypoglycemia',
      {
        occurred_at: date,
        value: '',
        symptoms: 'Exemplo',
        action_taken: 'Exemplo',
      },
      now,
    ).value,
    null,
  )
  assert.throws(() =>
    validateClinicalRecord(
      'hba1c',
      { occurred_on: '2026-01-15', value: 6.8 },
      now,
    ),
  )
  assert.equal(
    validateClinicalRecord(
      'hba1c',
      { occurred_on: '2026-01-01', value: 6.8 },
      now,
    ).value,
    6.8,
  )
  const gi = {
    occurred_at: date,
    nausea: '0',
    vomiting: '0',
    constipation: '0',
    diarrhea: '0',
    reflux: '0',
  }
  assert.equal(validateClinicalRecord('gi', gi, now).nausea, 0)
  assert.throws(() => validateClinicalRecord('gi', { ...gi, nausea: '4' }, now))
  assert.throws(() =>
    validateClinicalRecord('thyroid', { occurred_at: date }, now),
  )
  assert.equal(
    validateClinicalRecord(
      'thyroid',
      { occurred_at: date, fasting: 'unsure' },
      now,
    ).fasting,
    'unsure',
  )
})
test('blood pressure requires coherent values, permits an absent pulse and rejects injected identity', () => {
  const row = validateClinicalRecord(
    'pressure',
    {
      occurred_at: date,
      systolic: 120,
      diastolic: 80,
      pulse: '',
      patient_id: 'forged',
    },
    now,
  )
  assert.equal(row.pulse, null)
  assert.equal(row.patient_id, undefined)
  assert.throws(() =>
    validateClinicalRecord(
      'pressure',
      { occurred_at: date, systolic: 80, diastolic: 120 },
      now,
    ),
  )
})
test('preview persistence is whitelisted, duplicate-safe and clears permissions with logout', () => {
  const map = new Map()
  const storage = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  }
  const store = createClinicalPreviewStore(storage)
  let state = active('pressure')
  state = appendClinicalRecord(
    state,
    'pressure',
    { occurred_at: date, systolic: 120, diastolic: 80 },
    'one',
    now,
  )
  state = appendClinicalRecord(state, 'pressure', {}, 'one', now)
  store.save({ ...state, token: 'forged', user_id: 'forged' })
  const restored = createClinicalPreviewStore(storage).read()
  assert.equal(restored.records.length, 1)
  assert.equal(restored.token, undefined)
  assert.equal(restored.user_id, undefined)
  store.clear()
  assert.deepEqual(store.read(), emptyClinicalPreview())
})
test('corrupt, oversized and unsupported caches fail closed; blocked storage remains usable in memory', () => {
  for (const raw of [
    'bad json',
    JSON.stringify({ version: 9 }),
    'x'.repeat(750001),
    JSON.stringify({
      version: 1,
      mode: 'clinical-demo',
      data: { permissions: {}, records: [] },
    }),
  ]) {
    const store = createClinicalPreviewStore({
      getItem: () => raw,
      removeItem: () => {},
    })
    assert.deepEqual(store.read(), emptyClinicalPreview())
  }
  const store = createClinicalPreviewStore({
    getItem() {
      throw Error('blocked')
    },
    setItem() {
      throw Error('full')
    },
    removeItem() {
      throw Error('blocked')
    },
  })
  store.save(active('thyroid'))
  assert.equal(store.read().modules.thyroid.enabled, true)
  store.clear()
  assert.deepEqual(store.read(), emptyClinicalPreview())
})
test('all seven record types have valid fictional examples, including before 08:00', () => {
  const early = new Date('2026-01-12T01:00:00')
  const kinds = new Set()
  for (const module of ['diabetes', 'glp1', 'thyroid', 'pressure']) {
    for (const row of exampleRecords(module, early)) {
      validateClinicalRecord(row.kind, row, early)
      kinds.add(row.kind)
    }
  }
  assert.equal(kinds.size, 7)
})
