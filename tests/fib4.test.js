import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ageAtDate,
  calculateFib4,
  fib4Interpretation,
  validateFib4Inputs,
} from '../src/lib/fib4.js'

const date = '2026-05-10'

test('FIB-4 reproduces Sterling published examples', () => {
  assert.equal(
    calculateFib4(
      { age_years: 45, ast_u_l: 110, alt_u_l: 100, platelets_10e9_l: 99, test_date: date },
      { now: new Date('2026-11-23T12:00:00Z') },
    ).score,
    5,
  )
  assert.equal(
    calculateFib4(
      { age_years: 35, ast_u_l: 75, alt_u_l: 100, platelets_10e9_l: 263, test_date: date },
      { now: new Date('2026-11-23T12:00:00Z') },
    ).score,
    1,
  )
})

test('FIB-4 applies age-specific thresholds and withholds classification below 35', () => {
  const normal = (age, ast) =>
    calculateFib4(
      { age_years: age, ast_u_l: ast, alt_u_l: 100, platelets_10e9_l: 100, test_date: date },
      { now: new Date('2026-11-23T12:00:00Z') },
    )
  assert.equal(normal(34, 100).category, 'age_limited')
  assert.match(fib4Interpretation(normal(34, 100)), /menos confiável/)
  assert.equal(normal(64, 2).category, 'low')
  assert.equal(normal(64, 21).category, 'intermediate')
  assert.equal(normal(64, 50).category, 'high')
  assert.equal(normal(65, 3).category, 'low')
  assert.equal(normal(65, 31).category, 'intermediate')
})

test('FIB-4 rejects missing, invalid, future and out-of-range values', () => {
  const valid = {
    age_years: 45,
    ast_u_l: 110,
    alt_u_l: 100,
    platelets_10e9_l: 99,
    test_date: date,
  }
  for (const patch of [
    { age_years: '' },
    { age_years: 35.5 },
    { age_years: 17 },
    { ast_u_l: 0 },
    { alt_u_l: 1001 },
    { platelets_10e9_l: 9 },
    { test_date: '2026-02-30' },
    { test_date: '2026-11-24' },
  ])
    assert.throws(
      () => validateFib4Inputs({ ...valid, ...patch }, { now: new Date('2026-11-23T12:00:00Z') }),
    )
})

test('age at the laboratory date respects the calendar birthday', () => {
  assert.equal(ageAtDate('1981-05-11', '2026-05-10'), 44)
  assert.equal(ageAtDate('1981-05-10', '2026-05-10'), 45)
  assert.equal(ageAtDate('2020-02-30', '2026-05-10'), null)
})
