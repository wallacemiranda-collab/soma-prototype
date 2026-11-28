import test from 'node:test'
import assert from 'node:assert/strict'
import { getBuildEnvironment } from '../scripts/build.js'

function previewEnvironment(extra = {}) {
  return {
    VERCEL: '1',
    VERCEL_ENV: 'preview',
    VERCEL_GIT_COMMIT_REF: 'codex/cgm-patient-pilot',
    VITE_SUPABASE_URL: 'https://ctcsolobseerqnddahun.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'sb_publishable_staging_only',
    VITE_CGM_PILOT_ENABLED: 'false',
    VITE_HOMOLOGATION_ENABLED: 'false',
    VITE_CLINICAL_INTEGRATION_ENABLED: 'false',
    VITE_DEVICE_IMPORT_ENABLED: 'true',
    VITE_GLP1_TREATMENT_ENABLED: 'true',
    ...extra,
  }
}

test('only the dedicated preview branch can enable CGM with the homologation backend', () => {
  const result = getBuildEnvironment(previewEnvironment())
  assert.equal(result.isCgmPilotPreview, true)
  assert.equal(result.env.VITE_CGM_PILOT_ENABLED, 'true')
  assert.equal(result.env.VITE_HOMOLOGATION_ENABLED, 'true')
  assert.equal(result.env.VITE_CLINICAL_INTEGRATION_ENABLED, 'true')
  assert.equal(result.env.VITE_CALCULATORS_ENABLED, 'false')
  assert.equal(result.env.VITE_PATIENT_CALCULATORS_ENABLED, 'true')
  assert.equal(result.env.VITE_DEVICE_IMPORT_ENABLED, 'false')
  assert.equal(result.env.VITE_GLP1_TREATMENT_ENABLED, 'false')
  assert.equal(result.env.VITE_SUPABASE_URL, 'https://ctcsolobseerqnddahun.supabase.co')
})

test('CGM preview fails closed for wrong project, non-public key, or secrets', () => {
  for (const update of [
    { VITE_SUPABASE_URL: 'https://trlwhngxqfgksiponpzk.supabase.co' },
    { VITE_SUPABASE_ANON_KEY: 'sb_secret_never-use' },
    { VITE_SUPABASE_SERVICE_ROLE_KEY: 'private' },
  ]) {
    assert.throws(() => getBuildEnvironment(previewEnvironment(update)), /homologation URL/)
  }
})

test('other previews and production keep the CGM pilot disabled', () => {
  const otherPreview = getBuildEnvironment(previewEnvironment({ VERCEL_GIT_COMMIT_REF: 'main' }))
  assert.equal(otherPreview.env.VITE_CGM_PILOT_ENABLED, 'false')
  assert.equal(otherPreview.env.VITE_PATIENT_CALCULATORS_ENABLED, 'false')

  const production = getBuildEnvironment({
    VERCEL: '1',
    VERCEL_ENV: 'production',
    VITE_SUPABASE_URL: 'https://trlwhngxqfgksiponpzk.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'sb_publishable_production',
  })
  assert.equal(production.env.VITE_CGM_PILOT_ENABLED, 'false')
  assert.equal(production.env.VITE_PATIENT_CALCULATORS_ENABLED, 'false')
  assert.equal(production.env.VITE_DEVICE_IMPORT_ENABLED, 'false')
})
