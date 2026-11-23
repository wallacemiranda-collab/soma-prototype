import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateEagMgDl, eagReferences } from '../src/lib/eag.js'

test('eAG matches published ADAG examples, rounded to whole mg/dL', () => {
  assert.equal(calculateEagMgDl(6), 126)
  assert.equal(calculateEagMgDl(6.5), 140)
  assert.equal(calculateEagMgDl(7), 154)
  assert.equal(calculateEagMgDl(8), 183)
  assert.equal(calculateEagMgDl(9), 212)
  assert.equal(calculateEagMgDl(10), 240)
})

test('eAG accepts a decimal comma from a Brazilian lab value', () => {
  assert.equal(calculateEagMgDl('7,0'), 154)
})

test('eAG rejects blank, nonnumeric, nonfinite, zero, negative and impossible inputs', () => {
  for (const value of ['', 'abc', NaN, Infinity, 2.9, 20.1])
    assert.throws(() => calculateEagMgDl(value))
})

test('eAG sources include the ADAG study and patient-facing limitations', () => {
  assert.ok(eagReferences.some(({ url }) => url.includes('18540046')))
  assert.ok(eagReferences.some(({ url }) => url.includes('professional.diabetes.org')))
  assert.ok(eagReferences.some(({ url }) => url.includes('niddk.nih.gov')))
})
