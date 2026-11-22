import test from 'node:test'
import assert from 'node:assert/strict'
import { readBackendConfig } from '../src/lib/backendConfig.js'
import {
  homologationProject,
  isSyntheticLogin,
} from '../src/config/homologation.js'
import { collectPreviewFiles } from './staging/previewPackage.mjs'

test('homologation rejects production, unknown backends, legacy and private keys', () => {
  const valid = {
    VITE_HOMOLOGATION_ENABLED: 'true',
    VITE_SUPABASE_URL: `https://${homologationProject}.supabase.co`,
    VITE_SUPABASE_ANON_KEY: 'sb_publishable_synthetic',
  }
  assert.equal(readBackendConfig(valid).configured, true)
  for (const patch of [
    { VITE_SUPABASE_URL: 'https://trlwhngxqfgksiponpzk.supabase.co' },
    { VITE_SUPABASE_URL: 'https://other.invalid' },
    { VITE_SUPABASE_ANON_KEY: 'sb_secret_no' },
    { VITE_SUPABASE_URL: valid.VITE_SUPABASE_URL + '/' },
  ])
    assert.equal(readBackendConfig({ ...valid, ...patch }).configured, false)
})
test('homologation login accepts only generated fictitious identities', () => {
  assert.ok(isSyntheticLogin('endo-0123456789abcdef-patient@example.invalid'))
  for (const email of [
    'patient@example.com',
    'endo-0123456789abcdef-doctor@example.com',
    'endo-0123456789abcdef-admin@example.invalid',
    'real@example.invalid',
    null,
  ])
    assert.equal(isSyntheticLogin(email), false)
})
test('preview upload is allowlisted and cannot include credentials, unrelated projects or tests', () => {
  const result = collectPreviewFiles(
    new URL('../', import.meta.url).pathname,
    'sb_publishable_synthetic',
  )
  assert.ok(result.files.length > 20)
  assert.ok(result.files.some((row) => row.file === 'pnpm-workspace.yaml'))
  assert.ok(
    !result.files.some((row) =>
      /bianca|\.env|\.local|^tests\/|^supabase\//.test(row.file),
    ),
  )
  const config = JSON.parse(
    result.files.find((row) => row.file === 'vercel.json').data,
  )
  assert.equal(config.redirects.length, 4)
  assert.match(config.buildCommand, /VITE_HOMOLOGATION_ENABLED=true/)
  assert.match(config.buildCommand, new RegExp(homologationProject))
  assert.ok(config.headers[0].headers.some((row) => row.key === 'X-Robots-Tag'))
  assert.equal(result.digest.length, 64)
  assert.throws(() =>
    collectPreviewFiles(process.cwd(), 'sb_secret_not-public'),
  )
})
