import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ageAtDate,
  calculateFindrisc,
  findriscBand,
  findriscReferences,
} from '../src/lib/findrisc.js'

const lowest = {
  ageYears: 44,
  bmi: 24.9,
  waistCm: 79.9,
  waistReference: 'female',
  dailyActivity: true,
  dailyFruitVegetables: true,
  hypertensionMedication: false,
  highGlucoseHistory: false,
  familyHistory: 'none',
}

test('FINDRISC lowest-scoring answers sum to zero', () => {
  assert.equal(calculateFindrisc(lowest).score, 0)
})

test('FINDRISC published components apply exact age, BMI and waist boundaries', () => {
  assert.equal(calculateFindrisc({ ...lowest, ageYears: 45 }).points.age, 2)
  assert.equal(calculateFindrisc({ ...lowest, ageYears: 55 }).points.age, 3)
  assert.equal(calculateFindrisc({ ...lowest, ageYears: 65 }).points.age, 4)
  assert.equal(calculateFindrisc({ ...lowest, bmi: 25 }).points.bmi, 1)
  assert.equal(calculateFindrisc({ ...lowest, bmi: 30 }).points.bmi, 1)
  assert.equal(calculateFindrisc({ ...lowest, bmi: 30.01 }).points.bmi, 3)
  assert.equal(calculateFindrisc({ ...lowest, waistCm: 80 }).points.waist, 3)
  assert.equal(calculateFindrisc({ ...lowest, waistCm: 88 }).points.waist, 3)
  assert.equal(calculateFindrisc({ ...lowest, waistCm: 88.01 }).points.waist, 4)
  assert.equal(
    calculateFindrisc({ ...lowest, waistCm: 94, waistReference: 'male' }).points.waist,
    3,
  )
  assert.equal(
    calculateFindrisc({ ...lowest, waistCm: 102, waistReference: 'male' }).points.waist,
    3,
  )
  assert.equal(
    calculateFindrisc({ ...lowest, waistCm: 102.01, waistReference: 'male' }).points.waist,
    4,
  )
})

test('FINDRISC applies points for self-reported answers and reaches the 26-point maximum', () => {
  const result = calculateFindrisc({
    ageYears: 65,
    bmi: 30.1,
    waistCm: 102.1,
    waistReference: 'male',
    dailyActivity: false,
    dailyFruitVegetables: false,
    hypertensionMedication: true,
    highGlucoseHistory: true,
    familyHistory: 'first_degree',
  })
  assert.deepEqual(result.points, {
    age: 4,
    bmi: 3,
    waist: 4,
    activity: 2,
    diet: 1,
    bloodPressureMedication: 2,
    highGlucose: 5,
    familyHistory: 5,
  })
  assert.equal(result.score, 26)
  assert.deepEqual(result.band, { key: 'very_high', label: 'Muito alto' })
})

test('FINDRISC family history distinguishes no history, second-degree and first-degree', () => {
  assert.equal(calculateFindrisc({ ...lowest, familyHistory: 'none' }).points.familyHistory, 0)
  assert.equal(
    calculateFindrisc({ ...lowest, familyHistory: 'second_degree' }).points.familyHistory,
    3,
  )
  assert.equal(
    calculateFindrisc({ ...lowest, familyHistory: 'first_degree' }).points.familyHistory,
    5,
  )
})

test('FINDRISC Ministry of Health bands use non-overlapping score limits', () => {
  assert.deepEqual(findriscBand(6), { key: 'low', label: 'Baixo' })
  assert.deepEqual(findriscBand(7), {
    key: 'slightly_elevated',
    label: 'Levemente aumentado',
  })
  assert.deepEqual(findriscBand(11), {
    key: 'slightly_elevated',
    label: 'Levemente aumentado',
  })
  assert.deepEqual(findriscBand(12), { key: 'moderate', label: 'Moderado' })
  assert.deepEqual(findriscBand(14), { key: 'moderate', label: 'Moderado' })
  assert.deepEqual(findriscBand(15), { key: 'high', label: 'Alto' })
  assert.deepEqual(findriscBand(20), { key: 'high', label: 'Alto' })
  assert.deepEqual(findriscBand(21), { key: 'very_high', label: 'Muito alto' })
  for (const value of [-1, 27, 7.5, NaN]) assert.equal(findriscBand(value), null)
})

test('FINDRISC rejects incomplete, unsupported, implausible or noninteger inputs', () => {
  for (const patch of [
    { ageYears: '' },
    { ageYears: 17 },
    { ageYears: 121 },
    { ageYears: 44.5 },
    { bmi: 9.9 },
    { bmi: 100.1 },
    { waistCm: 29.9 },
    { waistCm: 300.1 },
    { waistReference: 'intersex' },
    { dailyActivity: undefined },
    { dailyFruitVegetables: 'maybe' },
    { hypertensionMedication: undefined },
    { highGlucoseHistory: undefined },
    { familyHistory: 'unknown' },
    { familyHistory: 'toString' },
  ])
    assert.throws(() => calculateFindrisc({ ...lowest, ...patch }))
})

test('age from birth date respects birthdays, leap days and invalid dates', () => {
  assert.equal(ageAtDate('1990-06-15', '2026-06-14'), 35)
  assert.equal(ageAtDate('1990-06-15', '2026-06-15'), 36)
  assert.equal(ageAtDate('2000-02-29', '2021-02-28'), 20)
  assert.equal(ageAtDate('2000-02-29', '2021-03-01'), 21)
  assert.equal(ageAtDate('2027-01-01', '2026-12-31'), null)
  assert.equal(ageAtDate('2024-02-30', '2026-12-31'), null)
})

test('FINDRISC identifies the ministry, professional society and Brazilian adaptation references', () => {
  assert.equal(findriscReferences.length, 3)
  assert.ok(findriscReferences.some(({ url }) => url.includes('saude.gov.br')))
  assert.ok(findriscReferences.some(({ url }) => url.includes('pmc.ncbi.nlm.nih.gov')))
})
