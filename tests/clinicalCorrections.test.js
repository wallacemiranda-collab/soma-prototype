import test from 'node:test'
import assert from 'node:assert/strict'
import {
  correctionReason,
  resolveClinicalHistory,
} from '../src/lib/clinicalCorrections.js'
import { measurementsInRange } from '../src/lib/clinicalModules.js'

const patient = 'patient'
const row = (id, value = 100, kind = 'glucose') => ({
  id,
  kind,
  patient_id: patient,
  module_version_id: 'version-1',
  value,
  context: 'fasting',
  occurred_at: '2026-01-01T10:00:00Z',
})
const change = (from, to, options = {}) => ({
  id: `change-${from}`,
  kind: 'glucose',
  patient_id: patient,
  actor_id: patient,
  previous_record_id: from,
  replacement_record_id: to,
  reason: 'Erro de digitação',
  created_at: '2026-01-02T10:00:00Z',
  ...options,
})

test('corrections resolve to one current record while retaining every original and reason', () => {
  const records = [row('original', 400), row('second', 200), row('third', 110)]
  const changes = [change('second', 'third'), change('original', 'second')]
  const result = resolveClinicalHistory(records, changes, patient)
  assert.equal(result.records.length, 1)
  assert.equal(result.records[0].value, 110)
  assert.deepEqual(
    result.historyRecords[0].audit.map((value) => value.before.value),
    [400, 200],
  )
  assert.equal(records[0].value, 400)
  assert.equal(
    measurementsInRange(result.records, { low: 80, high: 180 }).total,
    1,
  )
})
test('a voided record stays in history but cannot affect summaries or disappear silently', () => {
  const result = resolveClinicalHistory(
    [row('a')],
    [change('a', null)],
    patient,
  )
  assert.equal(result.records.length, 0)
  assert.equal(result.historyRecords.length, 1)
  assert.equal(result.historyRecords[0].voided, true)
  assert.equal(result.historyRecords[0].audit[0].after, null)
})
test('incomplete, cross-patient, changed-plan, cyclic or forked audit trails fail closed', () => {
  for (const [records, changes] of [
    [[row('a')], [change('a', 'missing')]],
    [
      [row('a'), { ...row('b'), patient_id: 'someone-else' }],
      [change('a', 'b')],
    ],
    [
      [row('a'), { ...row('b'), module_version_id: 'new-plan' }],
      [change('a', 'b')],
    ],
    [
      [row('a'), row('b')],
      [change('a', 'b'), change('b', 'a')],
    ],
    [
      [row('a'), row('b'), row('c')],
      [change('a', 'b'), change('a', 'c', { id: 'other' })],
    ],
    [[row('a')], [change('a', null, { actor_id: 'doctor' })]],
  ])
    assert.throws(() => resolveClinicalHistory(records, changes, patient))
  assert.throws(() => resolveClinicalHistory([], null, patient))
})
test('reasons are mandatory, bounded and normalized without accepting non-text values', () => {
  assert.equal(correctionReason('  Erro de digitação  '), 'Erro de digitação')
  for (const value of [null, {}, '', '  ', 'ab', 'a'.repeat(501)])
    assert.throws(() => correctionReason(value))
})
