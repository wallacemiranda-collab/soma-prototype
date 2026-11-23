import test from 'node:test'
import assert from 'node:assert/strict'
import { accessScopeLabels, createAccessRequestId } from '../src/lib/accessRequestId.js'

test('access request IDs are UUIDs and use the platform UUID generator when available', () => {
  const id = '58e7cd8e-9631-4e20-8434-f3e0b2d10d11'
  assert.equal(createAccessRequestId({ randomUUID: () => id }), id)
  assert.match(
    createAccessRequestId({ getRandomValues: (bytes) => bytes.fill(1) }),
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  )
  assert.throws(() => createAccessRequestId({}), /registro seguro/)
})

test('access scope labels are ready for the patient-facing history', () => {
  assert.deepEqual(accessScopeLabels, {
    clinical: 'dados clínicos',
    habits: 'hábitos',
    measurements: 'medidas e evolução',
    profile: 'perfil',
  })
})
