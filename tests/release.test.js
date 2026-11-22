import test from 'node:test'
import assert from 'node:assert/strict'
import { collectReleaseFiles, productionProject } from './release/package.mjs'

test('production packaging cannot reuse staging, private keys or preview settings', () => {
  const root = new URL('../', import.meta.url).pathname
  const valid = {
    url: `https://${productionProject}.supabase.co`,
    key: 'sb_publishable_release_test',
  }
  const result = collectReleaseFiles(root, valid)
  const config = JSON.parse(
    result.files.find((file) => file.file === 'vercel.json').data,
  )
  assert.match(config.buildCommand, /VITE_CLINICAL_INTEGRATION_ENABLED=true/)
  assert.match(config.buildCommand, /VITE_HOMOLOGATION_ENABLED=false/)
  assert.match(config.buildCommand, /VITE_CLINICAL_PREVIEW_ENABLED=false/)
  assert.equal(config.redirects.length, 4)
  assert.ok(result.files.some((file) => file.file === 'pnpm-workspace.yaml'))
  assert.ok(
    !result.files.some((file) =>
      /\.env|\.local|^tests\/|^supabase\/|bianca|robots\.txt/.test(file.file),
    ),
  )
  for (const patch of [
    { url: 'https://ctcsolobseerqnddahun.supabase.co' },
    { key: 'sb_secret_private' },
    { key: 'unsafe;command' },
    { googleEnabled: 'true' },
  ])
    assert.throws(() => collectReleaseFiles(root, { ...valid, ...patch }))
})
