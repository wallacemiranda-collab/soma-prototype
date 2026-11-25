import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateAuditC,
  calculateGad7,
  calculatePhq9,
  gad7Band,
  phq9Band,
} from '../src/lib/doctorScreeners.js'

test('PHQ-9 sums nine complete answers and flags any positive item 9', () => {
  assert.deepEqual(calculatePhq9([0, 1, 2, 3, 0, 1, 2, 3, 1]), {
    score: 13,
    maxScore: 27,
    band: 'Moderado',
    item9Positive: true,
  })
  assert.equal(calculatePhq9(Array(9).fill(0)).item9Positive, false)
})

test('PHQ-9 bands cover every published score range', () => {
  assert.equal(phq9Band(0), 'Mínimo')
  assert.equal(phq9Band(5), 'Leve')
  assert.equal(phq9Band(10), 'Moderado')
  assert.equal(phq9Band(15), 'Moderadamente grave')
  assert.equal(phq9Band(20), 'Grave')
  assert.equal(phq9Band(28), null)
})

test('GAD-7 sums seven complete answers and applies its published bands', () => {
  assert.deepEqual(calculateGad7([0, 1, 2, 3, 0, 1, 2]), {
    score: 9,
    maxScore: 21,
    band: 'Leve',
  })
  assert.equal(gad7Band(0), 'Mínimo')
  assert.equal(gad7Band(5), 'Leve')
  assert.equal(gad7Band(10), 'Moderado')
  assert.equal(gad7Band(15), 'Grave')
  assert.equal(gad7Band(22), null)
})

test('AUDIT-C only sums three item scores and does not classify the total', () => {
  assert.deepEqual(calculateAuditC([0, 2, 4]), { score: 6, maxScore: 12 })
  assert.deepEqual(calculateAuditC([4, 4, 4]), { score: 12, maxScore: 12 })
})

test('screening score functions reject incomplete or out-of-range answers', () => {
  assert.throws(() => calculatePhq9(Array(8).fill(0)), /todas as respostas/)
  assert.throws(() => calculatePhq9([3, 3, 3, 3, 3, 3, 3, 3, 4]), /entre 0 e 3/)
  assert.throws(() => calculateGad7([0, 1, 2, 3, 0, 1, '2']), /entre 0 e 3/)
  assert.throws(() => calculateAuditC([0, 1]), /todas as respostas/)
  assert.throws(() => calculateAuditC([0, 1, 5]), /entre 0 e 4/)
})
