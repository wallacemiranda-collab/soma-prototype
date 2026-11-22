import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateStagingConfig,
  stagingProject,
  productionProject,
  confirmStagingBackend,
} from './staging/support.mjs'

const valid = () => ({
  mode: 'homologation',
  project_id: stagingProject,
  url: `https://${stagingProject}.supabase.co`,
  publishable_key: 'sb_publishable_synthetic',
  run: '0123456789abcdef',
  accounts: [
    'patient',
    'otherPatient',
    'doctor',
    'otherDoctor',
    'nutritionist',
  ].map((role, i) => ({
    role,
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    email: `endo-0123456789abcdef-${role.toLowerCase()}@example.invalid`,
    password: 'synthetic-password-for-testing-only',
  })),
})
test('hosted staging checks refuse production, unknown projects and private keys', () => {
  assert.doesNotThrow(() => validateStagingConfig(valid()))
  for (const update of [
    { project_id: productionProject },
    { url: `https://${productionProject}.supabase.co` },
    { mode: 'production' },
    { publishable_key: 'sb_secret_never-use' },
    { accounts: [] },
  ])
    assert.throws(() => validateStagingConfig({ ...valid(), ...update }))
  const realEmail = valid()
  realEmail.accounts[0].email = 'real@example.com'
  assert.throws(() => validateStagingConfig(realEmail))
  const injection = valid()
  injection.run = "'; delete from auth.users; --"
  assert.throws(() => validateStagingConfig(injection))
})
test('hosted staging also requires a server-side environment marker', async () => {
  await assert.rejects(
    confirmStagingBackend({
      rpc: async () => ({ data: { environment: 'production' } }),
    }),
  )
  await assert.rejects(
    confirmStagingBackend({
      rpc: async () => ({ error: Error('Missing marker') }),
    }),
  )
  await confirmStagingBackend({
    rpc: async () => ({
      data: {
        environment: 'homologation',
        project_id: stagingProject,
        synthetic_only: true,
      },
    }),
  })
})
