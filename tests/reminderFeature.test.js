import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isSyntheticPatient,
  readReminderHomologationEnabled,
} from '../src/lib/reminderFeature.js'
import { homologationProject } from '../src/config/homologation.js'
import { createReminderRepository } from '../src/services/reminderRepository.js'
import { emptyReminderPreview } from '../src/lib/reminderPreview.js'

const testEnv = {
  VITE_REMINDERS_HOMOLOGATION_ENABLED: 'true',
  VITE_HOMOLOGATION_ENABLED: 'true',
  VITE_SUPABASE_URL: `https://${homologationProject}.supabase.co`,
  VITE_SUPABASE_ANON_KEY: 'sb_publishable_staging_test_key',
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

test('reminder repository rejects missing consent and professional identities before writing', async () => {
  let rpcCalls = 0
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
    rpc: async () => {
      rpcCalls += 1
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
})
