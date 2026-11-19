import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getCurrentSession,
  requestPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '../src/services/authService.js'

test('without configured backend no real authentication operation succeeds as demo', async () => {
  for (const action of [
    () => signInWithEmail('patient@example.invalid', 'any-password'),
    () => signUpWithEmail('patient@example.invalid', 'any-password', 'Patient'),
    () => signInWithGoogle(),
    () => requestPasswordReset('patient@example.invalid'),
  ]) {
    const result = await action()
    assert.ok(result.error)
    assert.equal(result.data, null)
  }
})

test('an old demonstration cannot be restored as an authenticated patient session', async () => {
  const session = await getCurrentSession()
  assert.equal(session.session, null)
})
