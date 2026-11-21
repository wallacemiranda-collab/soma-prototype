import test from 'node:test'
import assert from 'node:assert/strict'
import {
  bodyMassIndex,
  waistHeightRatio,
  entryAnthropometry,
  entryHeight,
  anthropometryReferences,
} from '../src/lib/anthropometry.js'
import {
  localDate,
  dateBefore,
  validateEntry,
  validateProfile,
} from '../src/lib/patientData.js'

test('BMI reproduces the WHO TRS 894 section 2.3 example: 70 kg, 1.75 m, 22.9', () => {
  assert.equal(Number(bodyMassIndex(70, 175).toFixed(1)), 22.9)
  assert.ok(anthropometryReferences[0].url.startsWith('https://iris.who.int/'))
})

test('waist/height reproduces NICE NG246: 96.5 cm / 170 cm = 0.57', () => {
  assert.equal(Number(waistHeightRatio(96.5, 170).toFixed(2)), 0.57)
  assert.ok(
    anthropometryReferences[1].url.startsWith('https://www.nice.org.uk/'),
  )
})

test('derived metrics reject absent, zero, nonfinite, out-of-range and nonnumeric inputs', () => {
  for (const value of [
    null,
    undefined,
    '',
    '175',
    0,
    -1,
    29.9,
    300.1,
    NaN,
    Infinity,
    true,
    {},
  ]) {
    assert.equal(bodyMassIndex(70, value), null)
    assert.equal(waistHeightRatio(96.5, value), null)
  }
  for (const value of [
    null,
    undefined,
    '',
    '70',
    0,
    -1,
    800.1,
    NaN,
    Infinity,
    {},
  ])
    assert.equal(bodyMassIndex(value, 175), null)
  for (const value of [null, undefined, '', '96.5', 0, 500.1, NaN, Infinity])
    assert.equal(waistHeightRatio(value, 170), null)
})

test('historical metrics never borrow height from a later profile or another record', () => {
  const old = { weight_kg: 70, waist_cm: 96.5, height_cm: null }
  assert.deepEqual(entryAnthropometry(old), { bmi: null, waistHeight: null })
  const record = { ...old, height_cm: 175 }
  assert.equal(Number(entryAnthropometry(record).bmi.toFixed(1)), 22.9)
  assert.deepEqual(old, { weight_kg: 70, waist_cm: 96.5, height_cm: null })
  assert.deepEqual(entryAnthropometry(undefined), {
    bmi: null,
    waistHeight: null,
  })
})

test('a height reference is captured only when saving today or already present in a past record', () => {
  const today = localDate(),
    past = dateBefore(1)
  assert.equal(entryHeight({ height_cm: 175 }, undefined, today, today), 175)
  assert.equal(
    entryHeight({ height_cm: 180 }, { height_cm: 175 }, past, today),
    175,
  )
  assert.equal(
    entryHeight({ height_cm: 180 }, { height_cm: null }, past, today),
    null,
  )
  assert.equal(entryHeight({ height_cm: 180 }, undefined, past, today), null)
  assert.equal(
    entryHeight({ height_cm: 180 }, { height_cm: 175 }, today, today),
    180,
  )
  assert.equal(
    entryHeight({ height_cm: null }, { height_cm: 175 }, today, today),
    175,
  )
})

test('height is optional, does not count as a daily measurement and cannot store derived outputs', () => {
  assert.equal(validateProfile({ full_name: 'Test' }).height_cm, null)
  assert.equal(
    validateProfile({ full_name: 'Test', height_cm: '170,5' }).height_cm,
    170.5,
  )
  assert.throws(() =>
    validateEntry({ entry_date: localDate(), height_cm: 175 }),
  )
  const entry = validateEntry({
    entry_date: localDate(),
    weight_kg: 70,
    height_cm: 175,
    bmi: 0,
    waistHeight: 0,
  })
  assert.equal(entry.height_cm, 175)
  assert.equal('bmi' in entry, false)
  for (const value of [0, -1, 29.9, 300.1, true, {}, Infinity]) {
    assert.throws(() =>
      validateProfile({ full_name: 'Test', height_cm: value }),
    )
    assert.throws(() =>
      validateEntry({
        entry_date: localDate(),
        weight_kg: 70,
        height_cm: value,
      }),
    )
  }
})
