import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import {
  confirmStagingBackend,
  loadStagingConfig,
} from './support.mjs'

test(
  'homologation reminders persist only with consent and remain patient-only',
  { timeout: 120000 },
  async () => {
    const config = loadStagingConfig()
    const actors = {}
    for (const role of ['patient', 'otherPatient', 'doctor']) {
      const account = config.accounts.find((entry) => entry.role === role)
      const client = createClient(config.url, config.publishable_key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
      const { data, error } = await client.auth.signInWithPassword({
        email: account.email,
        password: account.password,
      })
      assert.ifError(error)
      assert.equal(data.user.id, account.id)
      actors[role] = { id: account.id, client }
    }
    const { patient, otherPatient, doctor } = actors
    await confirmStagingBackend(patient.client)

    try {
      const schedule = {
        enabled: true,
        timeZone: 'America/Sao_Paulo',
        quiet: { enabled: true, start: '22:00', end: '08:00' },
        rules: [
          {
            id: 'medication',
            enabled: true,
            time: '08:15',
          },
          {
            id: 'application',
            enabled: false,
            time: '09:00',
            weekday: 1,
          },
          {
            id: 'weight',
            enabled: false,
            time: '08:00',
            weekday: 1,
          },
          {
            id: 'daily',
            enabled: false,
            time: '20:00',
          },
        ],
      }
      const saved = await patient.client.rpc(
        'endo_save_patient_reminder_schedule',
        { p_schedule: schedule, p_consent_accepted: true },
      )
      assert.ifError(saved.error)

      const persisted = await patient.client
        .from('patient_reminder_preferences')
        .select('*')
        .eq('patient_id', patient.id)
        .single()
      assert.ifError(persisted.error)
      assert.equal(persisted.data.enabled, true)
      assert.ok(persisted.data.consented_at)
      assert.equal(persisted.data.consent_version, 'endo-reminders-homologation-v1')
      const persistedRules = await patient.client
        .from('patient_reminder_rules')
        .select('*')
        .eq('patient_id', patient.id)
      assert.ifError(persistedRules.error)
      assert.equal(persistedRules.data.length, 4)
      assert.equal(
        persistedRules.data.find((rule) => rule.kind === 'medication')
          .reminder_time,
        '08:15:00',
      )

      const noConsent = await patient.client.rpc(
        'endo_save_patient_reminder_schedule',
        { p_schedule: schedule, p_consent_accepted: false },
      )
      assert.ok(noConsent.error, 'the server requires explicit consent')

      const doctorWrite = await doctor.client.rpc(
        'endo_save_patient_reminder_schedule',
        { p_schedule: schedule, p_consent_accepted: true },
      )
      assert.ok(doctorWrite.error, 'professional accounts cannot create schedules')

      const directWrite = await otherPatient.client
        .from('patient_reminder_preferences')
        .insert({
          patient_id: otherPatient.id,
          enabled: true,
          time_zone: 'America/Sao_Paulo',
          quiet_hours_enabled: true,
          quiet_start: '22:00:00',
          quiet_end: '08:00:00',
          consent_version: 'endo-reminders-homologation-v1',
          consented_at: new Date().toISOString(),
        })
      assert.ok(
        directWrite.error,
        'schedule writes must go through the guarded RPC',
      )

      for (const actor of [otherPatient, doctor]) {
        const visible = await actor.client
          .from('patient_reminder_preferences')
          .select('*')
          .eq('patient_id', patient.id)
        assert.ifError(visible.error)
        assert.deepEqual(visible.data, [])
        const rulesVisible = await actor.client
          .from('patient_reminder_rules')
          .select('*')
          .eq('patient_id', patient.id)
        assert.ifError(rulesVisible.error)
        assert.deepEqual(rulesVisible.data, [])
      }
      const revoked = await patient.client.rpc(
        'endo_revoke_patient_reminder_schedule',
      )
      assert.ifError(revoked.error)
      const revokedSettings = await patient.client
        .from('patient_reminder_preferences')
        .select('*')
        .eq('patient_id', patient.id)
        .single()
      assert.ifError(revokedSettings.error)
      assert.equal(revokedSettings.data.enabled, false)
      assert.ok(revokedSettings.data.consent_revoked_at)
      assert.equal(revokedSettings.data.time_zone, 'America/Sao_Paulo')
      assert.equal(revokedSettings.data.quiet_start, '22:00:00')
      const remainingRules = await patient.client
        .from('patient_reminder_rules')
        .select('*')
        .eq('patient_id', patient.id)
      assert.ifError(remainingRules.error)
      assert.deepEqual(remainingRules.data, [])
    } finally {
      await patient.client
        .from('patient_reminder_rules')
        .delete()
        .eq('patient_id', patient.id)
      await patient.client
        .from('patient_reminder_preferences')
        .delete()
        .eq('patient_id', patient.id)
      for (const actor of Object.values(actors))
        await actor.client.auth.signOut()
    }
  },
)
