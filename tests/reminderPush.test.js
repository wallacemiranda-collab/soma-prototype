import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  genericReminderPayload,
  isAllowedWebPushEndpoint as edgeAllowsEndpoint,
} from '../supabase/functions/endo-reminder-dispatch/pushGuards.js'
import { isAllowedWebPushEndpoint as appAllowsEndpoint } from '../src/lib/webPush.js'

test('the push worker displays a fixed generic message and opens only reminders', async () => {
  const worker = await readFile(
    new URL('../public/reminder-sw.js', import.meta.url),
    'utf8',
  )
  const manifest = JSON.parse(
    await readFile(
      new URL('../public/reminders-manifest.webmanifest', import.meta.url),
      'utf8',
    ),
  )
  assert.match(worker, /body: 'Hora de cuidar da sua rotina\.'/)
  assert.doesNotMatch(worker, /event\.data|medicação|medicamento|peso|tratamento/i)
  assert.match(worker, /new URL\('\/lembretes', self\.location\.origin\)/)
  assert.ok(
    worker.includes(
      'soma-prototype-nc87-[a-z0-9-]+-wallace-miranda-s-projects',
    ),
  )
  assert.doesNotMatch(worker, /endoplus\.vercel\.app/)
  assert.equal(manifest.start_url, '/lembretes')
  assert.equal(manifest.scope, '/')
  assert.deepEqual(JSON.parse(genericReminderPayload()), { path: '/lembretes' })
})

test('browser and server allow the same HTTPS push-service hosts', () => {
  const accepted = [
    'https://fcm.googleapis.com/fcm/send/example',
    'https://updates.push.services.mozilla.com/wpush/v2/example',
    'https://web.push.apple.com/example',
    'https://wns2.notify.windows.com/example',
  ]
  const rejected = [
    'http://fcm.googleapis.com/fcm/send/example',
    'https://fcm.googleapis.com.attacker.example/endpoint',
    'https://attacker.notify.windows.com.evil.example/endpoint',
    'https://fcm.googleapis.com:443/endpoint',
    'https://user@fcm.googleapis.com/endpoint',
    'https://unknown.example/endpoint',
  ]
  for (const endpoint of accepted) {
    assert.equal(appAllowsEndpoint(endpoint), true)
    assert.equal(edgeAllowsEndpoint(endpoint), true)
  }
  for (const endpoint of rejected) {
    assert.equal(appAllowsEndpoint(endpoint), false)
    assert.equal(edgeAllowsEndpoint(endpoint), false)
  }
})
