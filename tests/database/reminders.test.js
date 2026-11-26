import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test(
  'homologation reminder migration enforces synthetic patient consent and revocation',
  { timeout: 60000 },
  async () => {
    const db = new PGlite()
    try {
      await db.exec(`
        create role anon;
        create role authenticated;
        create role service_role;
        create schema auth;
        create table auth.users (id uuid primary key, email text);
        create table public.profiles (id uuid primary key);
        create function auth.uid() returns uuid language sql stable as $$
          select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
        $$;
        create function auth.jwt() returns jsonb language sql stable as $$
          select coalesce(
            nullif(current_setting('request.jwt.claims', true), '')::jsonb,
            '{}'::jsonb
          )
        $$;
        create function auth.role() returns text language sql stable as $$
          select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), current_user)
        $$;
        create function public.endo_homologation_info() returns jsonb
          language sql stable as $$
            select '{"environment":"homologation","project_id":"ctcsolobseerqnddahun","synthetic_only":true}'::jsonb
          $$;
        grant usage on schema auth, public to authenticated, anon, service_role;
        grant execute on function auth.uid(), auth.jwt(), auth.role() to authenticated, anon, service_role;
      `)
      const migration = await readFile(
        new URL('../../supabase/20261122150000_patient_reminders_homologation.sql', import.meta.url),
        'utf8',
      )
      await db.exec(`begin;\n${migration}\ncommit;`)
      const pushMigration = await readFile(
        new URL('../../supabase/20261122170000_patient_reminder_push_homologation.sql', import.meta.url),
        'utf8',
      )
      await db.exec(`begin;\n${pushMigration}\ncommit;`)

      const patientId = randomUUID()
      const otherPatientId = randomUUID()
      const doctorId = randomUUID()
      for (const [id, email] of [
        [patientId, 'endo-0123456789abcdef-patient@example.invalid'],
        [otherPatientId, 'endo-0123456789abcdef-otherpatient@example.invalid'],
        [doctorId, 'endo-0123456789abcdef-doctor@example.invalid'],
      ]) {
        await db.query('insert into auth.users(id,email) values ($1,$2)', [id, email])
        await db.query('insert into public.profiles(id) values ($1)', [id])
      }

      async function as(id, email, action, role = 'authenticated') {
        await db.exec('begin')
        try {
          await db.query(
            "select set_config('request.jwt.claim.sub', $1, true)",
            [id],
          )
          await db.query(
            "select set_config('request.jwt.claims', $1, true)",
            [JSON.stringify({ email })],
          )
          await db.query(
            "select set_config('request.jwt.claim.role', $1, true)",
            [role],
          )
          await db.exec(`set local role ${role}`)
          const result = await action()
          await db.exec('reset role; commit')
          return result
        } catch (error) {
          await db.exec('rollback')
          throw error
        }
      }

      const schedule = {
        enabled: true,
        timeZone: 'America/Sao_Paulo',
        quiet: { enabled: true, start: '22:00', end: '08:00' },
        rules: [
          { id: 'medication', enabled: true, time: '08:15' },
          { id: 'application', enabled: false, time: '09:00', weekday: 1 },
          { id: 'weight', enabled: false, time: '08:00', weekday: 1 },
          { id: 'daily', enabled: false, time: '20:00' },
        ],
      }
      await as(
        patientId,
        'endo-0123456789abcdef-patient@example.invalid',
        async () => {
          await db.query(
            'select public.endo_save_patient_reminder_schedule($1::jsonb, $2::boolean)',
            [JSON.stringify(schedule), true],
          )
          const settings = (
            await db.query(
              'select * from public.patient_reminder_preferences where patient_id = $1',
              [patientId],
            )
          ).rows[0]
          assert.equal(settings.enabled, true)
          assert.equal(settings.consent_version, 'endo-reminders-homologation-v1')
          assert.ok(settings.consented_at)
          const rules = await db.query(
            'select * from public.patient_reminder_rules where patient_id = $1',
            [patientId],
          )
          assert.equal(rules.rows.length, 4)

          const subscription = {
            endpoint: 'https://fcm.googleapis.com/fcm/send/synthetic-test',
            keys: {
              p256dh: 'A'.repeat(87),
              auth: 'A'.repeat(22),
            },
          }
          const savedSubscription = await db.query(
            'select public.endo_upsert_patient_reminder_push_subscription($1::jsonb, $2::boolean) as id',
            [JSON.stringify(subscription), true],
          )
          assert.ok(savedSubscription.rows[0].id)
          const ownSubscription = await db.query(
            'select id, endpoint from public.patient_reminder_push_subscriptions where patient_id = $1',
            [patientId],
          )
          assert.equal(ownSubscription.rows.length, 1)
          assert.equal(ownSubscription.rows[0].endpoint, subscription.endpoint)
        },
      )

      await as(
        otherPatientId,
        'endo-0123456789abcdef-otherpatient@example.invalid',
        async () => {
          const rows = await db.query(
            'select * from public.patient_reminder_preferences where patient_id = $1',
            [patientId],
          )
          assert.deepEqual(rows.rows, [])
          await db.exec('savepoint expected_denied_write')
          await assert.rejects(
            db.query(
              'insert into public.patient_reminder_preferences (patient_id, enabled, consent_version, consented_at) values ($1, false, $2, now())',
              [otherPatientId, 'endo-reminders-homologation-v1'],
            ),
            /permission denied/,
          )
          await db.exec('rollback to savepoint expected_denied_write')
        },
      )

      await assert.rejects(
        as(doctorId, 'endo-0123456789abcdef-doctor@example.invalid', () =>
          db.query(
            'select public.endo_save_patient_reminder_schedule($1::jsonb, true)',
            [JSON.stringify(schedule)],
          ),
        ),
        /Synthetic patient account required/,
      )
      await assert.rejects(
        as(patientId, 'endo-0123456789abcdef-patient@example.invalid', () =>
          db.query(
            'select public.endo_save_patient_reminder_schedule($1::jsonb, false)',
            [JSON.stringify(schedule)],
          ),
        ),
        /Patient consent is required/,
      )
      await assert.rejects(
        as(patientId, 'endo-0123456789abcdef-patient@example.invalid', async () =>
          db.query(
            'select public.endo_upsert_patient_reminder_push_subscription($1::jsonb, true)',
            [JSON.stringify({
              endpoint: 'https://fcm.googleapis.com.evil.example/endpoint',
              keys: { p256dh: 'A'.repeat(87), auth: 'A'.repeat(22) },
            })],
          ),
        ),
        /Invalid push subscription/,
      )

      const dueAt = '2026-11-22T11:15:00Z'
      const delivery = await as(
        patientId,
        'endo-0123456789abcdef-patient@example.invalid',
        async () => {
          const rows = await db.query(
            'select * from public.endo_claim_due_patient_reminder_deliveries($1::timestamptz, $2::integer)',
            [dueAt, 10],
          )
          return rows.rows
        },
        'service_role',
      )
      assert.equal(delivery.length, 1)
      assert.equal(delivery[0].endpoint, 'https://fcm.googleapis.com/fcm/send/synthetic-test')
      await as(
        patientId,
        'endo-0123456789abcdef-patient@example.invalid',
        async () => {
          await db.query(
            "select public.endo_finish_patient_reminder_delivery($1::uuid, 'sent', 201::smallint)",
            [delivery[0].delivery_id],
          )
        },
        'service_role',
      )
      const duplicate = await as(
        patientId,
        'endo-0123456789abcdef-patient@example.invalid',
        async () => {
          const rows = await db.query(
            'select * from public.endo_claim_due_patient_reminder_deliveries($1::timestamptz, $2::integer)',
            [dueAt, 10],
          )
          return rows.rows
        },
        'service_role',
      )
      assert.deepEqual(duplicate, [])

      await as(
        patientId,
        'endo-0123456789abcdef-patient@example.invalid',
        async () => {
          await db.query('select public.endo_revoke_patient_reminder_schedule()')
          const settings = (
            await db.query(
              'select * from public.patient_reminder_preferences where patient_id = $1',
              [patientId],
            )
          ).rows[0]
          assert.equal(settings.enabled, false)
          assert.ok(settings.consent_revoked_at)
          const rules = await db.query(
            'select * from public.patient_reminder_rules where patient_id = $1',
            [patientId],
          )
          assert.deepEqual(rules.rows, [])
          const subscriptions = await db.query(
            'select id, endpoint from public.patient_reminder_push_subscriptions where patient_id = $1',
            [patientId],
          )
          assert.deepEqual(subscriptions.rows, [])
        },
      )
    } finally {
      await db.close()
    }
  },
)
