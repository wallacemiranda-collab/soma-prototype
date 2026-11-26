import test from 'node:test'
import assert from 'node:assert/strict'
import { getBuildEnvironment } from '../scripts/build.js'

const preview = (patch = {}) =>
  getBuildEnvironment({
    VERCEL: '1',
    VERCEL_ENV: 'preview',
    VERCEL_GIT_COMMIT_REF: 'codex/fase9-diario-alimentar',
    VITE_SUPABASE_URL: 'https://trlwhngxqfgksiponpzk.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'sb_publishable_test',
    VITE_GOOGLE_AUTH_ENABLED: 'true',
    ...patch,
  })

test('food diary preview is isolated from the production backend and clinical integrations', () => {
  const result = preview()
  assert.equal(result.isFoodDiaryPreview, true)
  assert.equal(result.env.VITE_FOOD_DIARY_ENABLED, 'true')
  assert.equal(result.env.VITE_SUPABASE_URL, '')
  assert.equal(result.env.VITE_SUPABASE_ANON_KEY, '')
  assert.equal(result.env.VITE_CALCULATORS_ENABLED, 'false')
  assert.equal(result.env.VITE_HOMOLOGATION_ENABLED, 'false')
  assert.equal(result.env.VITE_CLINICAL_INTEGRATION_ENABLED, 'false')
  assert.equal(result.env.VITE_PHASE3_PREVIEW_ENABLED, 'false')
  assert.equal(result.env.VITE_GOOGLE_AUTH_ENABLED, 'false')
})

test('food diary preview refuses private keys exposed through VITE variables', () => {
  assert.throws(
    () => preview({ VITE_SUPABASE_SERVICE_ROLE_KEY: 'private-test-key' }),
    /private client keys/,
  )
})

test('production and unrelated Vercel previews keep the food diary disabled', () => {
  const production = getBuildEnvironment({
    VERCEL: '1',
    VERCEL_ENV: 'production',
    VITE_SUPABASE_URL: 'https://trlwhngxqfgksiponpzk.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'sb_publishable_test',
    VITE_FOOD_DIARY_ENABLED: 'true',
  })
  assert.equal(production.env.VITE_FOOD_DIARY_ENABLED, 'false')
  const otherPreview = getBuildEnvironment({
    VERCEL: '1',
    VERCEL_ENV: 'preview',
    VERCEL_GIT_COMMIT_REF: 'feature/other',
    VITE_FOOD_DIARY_ENABLED: 'true',
  })
  assert.equal(otherPreview.env.VITE_FOOD_DIARY_ENABLED, 'false')
})
