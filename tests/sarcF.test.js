import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateSarcF, sarcFReferences } from '../src/lib/sarcF.js'

const noDifficulty = {
  strength: 0,
  walking: 0,
  chair: 0,
  stairs: 0,
  falls: 0,
}

test('SARC-F minimum answers produce zero and do not reach the cutoff', () => {
  const result = calculateSarcF(noDifficulty)
  assert.equal(result.score, 0)
  assert.equal(result.maxScore, 10)
  assert.equal(result.suggestive, false)
})

test('SARC-F maximum answers produce 10 and suggest further assessment', () => {
  const result = calculateSarcF({
    strength: 2,
    walking: 2,
    chair: 2,
    stairs: 2,
    falls: 2,
  })
  assert.equal(result.score, 10)
  assert.equal(result.suggestive, true)
})

test('SARC-F applies the traditional cutoff at exactly 4 points', () => {
  assert.equal(calculateSarcF({ ...noDifficulty, strength: 1, walking: 1, chair: 2 }).suggestive, true)
  assert.equal(calculateSarcF({ ...noDifficulty, strength: 1, walking: 1, chair: 1 }).suggestive, false)
})

test('SARC-F accepts the Brazilian form answers as strings from HTML selects', () => {
  const result = calculateSarcF({
    strength: '1',
    walking: '2',
    chair: '0',
    stairs: '1',
    falls: '0',
  })
  assert.equal(result.score, 4)
  assert.deepEqual(result.points, {
    strength: 1,
    walking: 2,
    chair: 0,
    stairs: 1,
    falls: 0,
  })
})

test('SARC-F rejects missing or unsupported answers', () => {
  const { falls: _falls, ...missingFalls } = noDifficulty
  assert.throws(() => calculateSarcF(missingFalls), /quedas/)
  assert.throws(() => calculateSarcF({ ...noDifficulty, falls: '' }), /quedas/)
  assert.throws(() => calculateSarcF({ ...noDifficulty, falls: 3 }), /quedas/)
  assert.throws(() => calculateSarcF({ ...noDifficulty, chair: 'NaN' }), /cadeira/)
})

test('SARC-F references include Brazilian validation and clinical interpretation', () => {
  assert.ok(sarcFReferences.some(({ url }) => url.includes('pubmed.ncbi.nlm.nih.gov/27650212')))
  assert.ok(sarcFReferences.some(({ url }) => url.includes('scielo.br')))
  assert.ok(sarcFReferences.some(({ title }) => title.includes('5 kg')))
})
