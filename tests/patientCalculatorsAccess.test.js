import test from 'node:test'
import assert from 'node:assert/strict'
import { canPatientUseCalculators } from '../src/config/calculators.js'

test('patient calculator access can be enabled without enabling doctor calculators', () => {
  assert.equal(canPatientUseCalculators({
    VITE_CALCULATORS_ENABLED: 'false',
    VITE_PATIENT_CALCULATORS_ENABLED: 'true',
  }), true)
})

test('patient calculator access follows the general flag or defaults closed', () => {
  assert.equal(canPatientUseCalculators({ VITE_CALCULATORS_ENABLED: 'true' }), true)
  assert.equal(canPatientUseCalculators({ VITE_CALCULATORS_ENABLED: 'false' }), false)
  assert.equal(canPatientUseCalculators({}), false)
})
