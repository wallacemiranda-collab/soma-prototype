import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import {
  isPhase3PreviewHost,
  readPhase3Preview,
} from '../src/lib/phase3Preview.js'
import { getBuildEnvironment } from '../scripts/build.js'
import { collectPhase3Files } from './phase3/package.mjs'

const root = new URL('../', import.meta.url).pathname
test('preview is opt-in, local or isolated, and rejects every backend connection', () => {
  const env = { VITE_PHASE3_PREVIEW_ENABLED: 'true' }
  for (const host of [
    'localhost',
    '127.0.0.1',
    'soma-prototype-nc87-abc123-wallace-miranda-s-projects.vercel.app',
    'soma-prototype-nc87-git-codex-fase3-previa-wallace-miranda-s-projects.vercel.app',
  ])
    assert.equal(readPhase3Preview(env, host).allowed, true)
  for (const host of [
    'endoplus.vercel.app',
    'endo-plus.vercel.app',
    'soma-prototype-nc87.vercel.app',
    'soma-prototype-nc87-git-main-wallace-miranda-s-projects.vercel.app',
    'soma-prototype-nc87-wallace-miranda-s-projects.vercel.app',
    'evil.example',
  ])
    assert.equal(readPhase3Preview(env, host).allowed, false)
  assert.equal(isPhase3PreviewHost('endoplus.vercel.app'), false)
  assert.equal(readPhase3Preview({}, 'localhost').requested, false)
  for (const patch of [
    { VITE_SUPABASE_URL: 'https://trlwhngxqfgksiponpzk.supabase.co' },
    { VITE_SUPABASE_ANON_KEY: 'some-key' },
    { VITE_GOOGLE_AUTH_ENABLED: 'true' },
    { VITE_CLINICAL_INTEGRATION_ENABLED: 'true' },
    { VITE_HOMOLOGATION_ENABLED: 'true' },
  ])
    assert.equal(
      readPhase3Preview({ ...env, ...patch }, 'localhost').allowed,
      false,
    )
  const client = readFileSync(
    new URL('../src/lib/supabaseClient.js', import.meta.url),
    'utf8',
  )
  assert.match(client, /configured && !phase3Preview.requested/)
})
test('only the isolated Vercel preview branch receives demo build settings', () => {
  const source = {
    VERCEL: '1',
    VERCEL_ENV: 'preview',
    VERCEL_GIT_COMMIT_REF: 'codex/fase3-previa',
    VITE_SUPABASE_URL: 'https://production.example.invalid',
    VITE_SUPABASE_ANON_KEY: 'must-not-reach-the-preview-build',
    VITE_GOOGLE_AUTH_ENABLED: 'true',
    VITE_PHASE3_PREVIEW_ENABLED: 'true',
  }
  const built = getBuildEnvironment(source)
  assert.equal(built.isPhase3Preview, true)
  assert.equal(built.env.VITE_PHASE3_PREVIEW_ENABLED, 'true')
  assert.equal(built.env.VITE_SUPABASE_URL, '')
  assert.equal(built.env.VITE_SUPABASE_ANON_KEY, '')
  assert.equal(built.env.VITE_CLINICAL_INTEGRATION_ENABLED, 'false')
  assert.equal(built.env.VITE_HOMOLOGATION_ENABLED, 'false')
  assert.equal(built.env.VITE_GOOGLE_AUTH_ENABLED, 'false')
  assert.equal(built.env.VITE_REMINDERS_HOMOLOGATION_ENABLED, 'false')
  assert.equal(built.env.VITE_PHASE3_PREVIEW_ENABLED, 'true')
  assert.equal(source.VITE_SUPABASE_URL, 'https://production.example.invalid')

  const production = getBuildEnvironment({
    ...source,
    VERCEL_ENV: 'production',
    VERCEL_GIT_COMMIT_REF: 'main',
  })
  assert.equal(production.isPhase3Preview, false)
  assert.equal(production.env.VITE_PHASE3_PREVIEW_ENABLED, 'false')
  assert.equal(production.env.VITE_REMINDERS_HOMOLOGATION_ENABLED, 'false')
  assert.equal(production.env.VITE_SUPABASE_URL, source.VITE_SUPABASE_URL)
  assert.equal(production.env.VITE_SUPABASE_ANON_KEY, source.VITE_SUPABASE_ANON_KEY)
  const otherPreview = getBuildEnvironment({
    ...source,
    VERCEL_GIT_COMMIT_REF: 'codex/fase2-previa',
  })
  assert.equal(otherPreview.isPhase3Preview, false)
  assert.equal(otherPreview.env.VITE_PHASE3_PREVIEW_ENABLED, 'false')
  assert.equal(otherPreview.env.VITE_REMINDERS_HOMOLOGATION_ENABLED, 'false')
  assert.throws(
    () => getBuildEnvironment({ VERCEL: '1', VERCEL_ENV: 'preview' }),
    /branch metadata/,
  )
})

test('reminder homologation builds require a branch-scoped staging publishable key', () => {
  const source = {
    VERCEL: '1',
    VERCEL_ENV: 'preview',
    VERCEL_GIT_COMMIT_REF: 'codex/lembretes-homologacao',
    VITE_SUPABASE_URL: 'https://ctcsolobseerqnddahun.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'sb_publishable_staging_key',
    VITE_REMINDER_VAPID_PUBLIC_KEY: `B${'A'.repeat(86)}`,
  }
  const built = getBuildEnvironment(source)
  assert.equal(built.isReminderHomologationPreview, true)
  assert.equal(built.env.VITE_HOMOLOGATION_ENABLED, 'true')
  assert.equal(built.env.VITE_REMINDERS_HOMOLOGATION_ENABLED, 'true')
  assert.equal(built.env.VITE_PHASE3_PREVIEW_ENABLED, 'false')
  assert.equal(built.env.VITE_GOOGLE_AUTH_ENABLED, 'false')

  for (const patch of [
    { VITE_SUPABASE_URL: 'https://trlwhngxqfgksiponpzk.supabase.co' },
    { VITE_SUPABASE_URL: 'https://unrelated.supabase.co' },
    { VITE_SUPABASE_ANON_KEY: 'sb_secret_not_for_browsers' },
    { VITE_SUPABASE_SERVICE_ROLE_KEY: 'must-not-be-exposed' },
  ])
    assert.throws(
      () => getBuildEnvironment({ ...source, ...patch }),
      /staging URL, publishable staging key, and a valid public push key/,
    )

  const normalPreview = getBuildEnvironment({
    ...source,
    VERCEL_GIT_COMMIT_REF: 'codex/another-feature',
  })
  assert.equal(normalPreview.env.VITE_REMINDERS_HOMOLOGATION_ENABLED, 'false')
})
test('worker handles only same-origin navigations, stores nothing and cannot send push', async () => {
  const source = readFileSync(
    new URL('../public/phase3-sw.js', import.meta.url),
    'utf8',
  )
  const listeners = {},
    calls = []
  vm.runInNewContext(source, {
    self: {
      location: { hostname: 'localhost', origin: 'http://localhost' },
      addEventListener: (event, work) => {
        listeners[event] = work
      },
    },
    URL,
    Response,
    fetch: async (request, options) => {
      assert.equal(options.cache, 'no-store')
      calls.push(request.url)
      throw new Error('offline')
    },
  })
  assert.deepEqual(Object.keys(listeners).sort(), ['fetch', 'install'])
  assert.doesNotMatch(
    source,
    /caches\.|indexedDB|showNotification|pushManager|skipWaiting|importScripts/,
  )
  for (const request of [
    {
      url: 'https://trlwhngxqfgksiponpzk.supabase.co/rest/v1/profiles',
      method: 'GET',
      mode: 'cors',
    },
    { url: 'http://localhost/api/private', method: 'GET', mode: 'navigate' },
    { url: 'http://localhost/registro', method: 'POST', mode: 'navigate' },
    { url: 'http://localhost/private.json', method: 'GET', mode: 'cors' },
  ])
    listeners.fetch({
      request,
      respondWith() {
        assert.fail('API or data intercepted')
      },
    })
  assert.equal(calls.length, 0)
  let response
  listeners.fetch({
    request: {
      url: 'http://localhost/lembretes',
      method: 'GET',
      mode: 'navigate',
    },
    respondWith(value) {
      response = value
    },
  })
  const result = await response
  assert.equal(result.status, 503)
  assert.equal(result.headers.get('Cache-Control'), 'no-store')
  assert.match(await result.text(), /Nenhum registro de saúde/)
  const denied = {}
  vm.runInNewContext(source, {
    self: {
      location: {
        hostname: 'endoplus.vercel.app',
        origin: 'https://endoplus.vercel.app',
      },
      addEventListener: (event, work) => {
        denied[event] = work
      },
    },
    URL,
    Response,
    fetch() {
      assert.fail('Official host intercepted')
    },
  })
  let installing
  denied.install({
    waitUntil(value) {
      installing = value
    },
  })
  await assert.rejects(installing, /Preview origin required/)
})
test('preview package has no credentials and contains valid, deterministic PWA assets', () => {
  const { files } = collectPhase3Files(root)
  const config = JSON.parse(
    files.find((file) => file.file === 'vercel.json').data,
  )
  assert.equal(config.buildCommand, 'pnpm build')
  assert.ok(config.buildCommand.length <= 256)
  const packageConfig = JSON.parse(
    files.find((file) => file.file === 'package.json').data,
  )
  assert.match(packageConfig.scripts.build, /VITE_PHASE3_PREVIEW_ENABLED=true/)
  assert.match(
    packageConfig.scripts.build,
    /VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= /,
  )
  assert.match(
    packageConfig.scripts.build,
    /VITE_CLINICAL_INTEGRATION_ENABLED=false/,
  )
  assert.equal(config.redirects.length, 4)
  assert.ok(
    !files.some((file) =>
      /\.env|\.local|^tests\/|^supabase\/|bianca/.test(file.file),
    ),
  )
  const manifest = JSON.parse(
    files.find((file) => file.file === 'public/manifest.webmanifest').data,
  )
  assert.equal(manifest.start_url, '/instalar')
  assert.equal(manifest.display, 'standalone')
  for (const size of [180, 192, 512]) {
    const file = files.find(
      (row) => row.file === `public/icons/endo-preview-${size}.png`,
    )
    assert.equal(file.encoding, 'base64')
    const png = Buffer.from(file.data, 'base64')
    assert.equal(png.readUInt32BE(16), size)
    assert.equal(png.readUInt32BE(20), size)
  }
})
