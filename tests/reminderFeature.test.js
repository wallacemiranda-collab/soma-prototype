import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isSyntheticPatient,
  readReminderHomologationEnabled,
} from '../src/lib/reminderFeature.js'
import { homologationProject } from '../src/config/homologation.js'
import { createReminderRepository } from '../src/services/reminderRepository.js'
import { emptyReminderPreview } from '../src/lib/reminderPreview.js'
import {
  decodeVapidPublicKey,
  isAllowedWebPushEndpoint,
  isValidVapidPublicKey,
} from '../src/lib/webPush.js'

const testEnv = {
  VITE_REMINDERS_HOMOLOGATION_ENABLED: 'true',
  VITE_HOMOLOGATION_ENABLED: 'true',
  VITE_SUPABASE_URL: `https://${homologationProject}.supabase.co`,
  VITE_SUPABASE_ANON_KEY: 'sb_publishable_staging_test_key',
  VITE_REMINDER_VAPID_PUBLIC_KEY: `B${'A'.repeat(86)}`,
}

test('real reminder preferences require the exact synthetic staging backend', () => {
  assert.equal(readReminderHomologationEnabled(testEnv), true)
  for (const patch of [
    { VITE_REMINDERS_HOMOLOGATION_ENABLED: 'false' },
    { VITE_HOMOLOGATION_ENABLED: 'false' },
    { VITE_PHASE3_PREVIEW_ENABLED: 'true' },
    { VITE_SUPABASE_URL: 'https://trlwhngxqfgksiponpzk.supabase.co' },
    { VITE_SUPABASE_URL: 'https://unknown.supabase.co' },
    { VITE_SUPABASE_ANON_KEY: 'sb_secret_not_for_browsers' },
  ])
    assert.equal(
      readReminderHomologationEnabled({ ...testEnv, ...patch }),
      false,
    )
})

test('only generated synthetic patient accounts can use homologation reminders', () => {
  assert.equal(
    isSyntheticPatient('endo-0123456789abcdef-patient@example.invalid'),
    true,
  )
  assert.equal(
    isSyntheticPatient('endo-0123456789abcdef-otherpatient@example.invalid'),
    true,
  )
  for (const email of [
    'endo-0123456789abcdef-doctor@example.invalid',
    'patient@example.com',
    'endo-invalid-patient@example.invalid',
    null,
  ])
    assert.equal(isSyntheticPatient(email), false)
})

test('push subscriptions accept only a well-formed VAPID key and known HTTPS push hosts', () => {
  const key = testEnv.VITE_REMINDER_VAPID_PUBLIC_KEY
  assert.equal(isValidVapidPublicKey(key), true)
  assert.equal(decodeVapidPublicKey(key).length, 65)
  assert.equal(decodeVapidPublicKey(key)[0], 4)
  for (const invalid of ['', 'A'.repeat(87), `${key}A`, 'https://example.com'])
    assert.equal(isValidVapidPublicKey(invalid), false)

  for (const endpoint of [
    'https://fcm.googleapis.com/fcm/send/example',
    'https://updates.push.services.mozilla.com/wpush/v2/example',
    'https://web.push.apple.com/example',
    'https://wns2.notify.windows.com/example',
  ])
    assert.equal(isAllowedWebPushEndpoint(endpoint), true)
  for (const endpoint of [
    'http://fcm.googleapis.com/fcm/send/example',
    'https://fcm.googleapis.com.example.org/endpoint',
    'https://user@fcm.googleapis.com/endpoint',
    'https://fcm.googleapis.com:8443/endpoint',
    'https://unknown.example/endpoint',
  ])
    assert.equal(isAllowedWebPushEndpoint(endpoint), false)
})

test('reminder repository rejects missing consent and professional identities before writing', async () => {
  let rpcCalls = 0
  let lastRpc
  const patientClient = {
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: '10000000-0000-4000-8000-000000000001',
            email: 'endo-0123456789abcdef-patient@example.invalid',
          },
        },
      }),
    },
    rpc: async (name, payload) => {
      rpcCalls += 1
      lastRpc = { name, payload }
      return { data: null, error: null }
    },
  }
  const patientRepo = createReminderRepository(patientClient, { enabled: true })
  await assert.rejects(
    patientRepo.save(
      '10000000-0000-4000-8000-000000000001',
      emptyReminderPreview(),
      { consentAccepted: false },
    ),
    /Autorize salvar/,
  )
  assert.equal(rpcCalls, 0)
  await assert.rejects(
    patientRepo.savePushSubscription(
      '10000000-0000-4000-8000-000000000001',
      {
        endpoint: 'https://fcm.googleapis.com/fcm/send/example',
        keys: { p256dh: 'A'.repeat(87), auth: 'A'.repeat(22) },
      },
      { consentAccepted: false },
    ),
    /Autorize as notificações/,
  )
  assert.equal(rpcCalls, 0)
  await patientRepo.savePushSubscription(
    '10000000-0000-4000-8000-000000000001',
    {
      endpoint: 'https://fcm.googleapis.com/fcm/send/example',
      keys: { p256dh: 'A'.repeat(87), auth: 'A'.repeat(22) },
    },
    { consentAccepted: true },
  )
  assert.equal(lastRpc.name, 'endo_upsert_patient_reminder_push_subscription')
  assert.equal(lastRpc.payload.p_consent_accepted, true)

  const doctorRepo = createReminderRepository(
    {
      auth: {
        getUser: async () => ({
          data: {
            user: {
              id: '10000000-0000-4000-8000-000000000002',
              email: 'endo-0123456789abcdef-doctor@example.invalid',
            },
          },
        }),
      },
    },
    { enabled: true },
  )
  await assert.rejects(
    doctorRepo.load('10000000-0000-4000-8000-000000000002'),
    /conta fictícia de paciente/,
  )
  await assert.rejects(
    doctorRepo.savePushSubscription(
      '10000000-0000-4000-8000-000000000002',
      { endpoint: 'https://fcm.googleapis.com/fcm/send/example', keys: {} },
      { consentAccepted: true },
    ),
    /conta fictícia de paciente/,
  )
})
