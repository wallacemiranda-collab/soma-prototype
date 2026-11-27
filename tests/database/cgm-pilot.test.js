import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'

const root = new URL('../../', import.meta.url)
const source = 'libreview_csv'
const consentVersion = 'endo-cgm-import-v1'
const parserVersion = 'libreview-glucose-v1'
const pdfSource = 'libreview_pdf'
const pdfConsentVersion = 'endo-cgm-pdf-v1'
const pdfParserVersion = 'libreview-agp-text-v1'
const actorScopedRpcs = new Set([
  'endo_grant_clinical_activation',
  'endo_configure_clinical_module',
  'endo_grant_cgm_consent',
  'endo_revoke_cgm_consent',
  'endo_delete_cgm_imports',
  'endo_import_cgm_readings',
  'endo_doctor_cgm_page',
  'endo_register_cgm_pdf_report',
  'endo_doctor_cgm_pdf_page',
  'endo_authorize_cgm_pdf_file_access',
  'endo_stage_delete_cgm_pdf_reports',
  'endo_finalize_delete_cgm_pdf_reports',
])

test('CGM pilot consent, import, patient isolation, physician authorization, audit and deletion', { timeout: 90000 }, async (t) => {
  const db = new PGlite({ extensions: { pgcrypto } })
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create schema extensions; create schema storage;
      create extension if not exists pgcrypto with schema extensions;
      create table auth.users (
        id uuid primary key, aud text, role text, email text,
        raw_user_meta_data jsonb default '{}'
      );
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      grant usage on schema auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
      create table storage.buckets (
        id text primary key, name text not null, public boolean not null default false,
        file_size_limit bigint, allowed_mime_types text[]
      );
      create table storage.objects (
        id uuid primary key default gen_random_uuid(), bucket_id text not null,
        name text not null, owner_id text, unique (bucket_id, name)
      );
      alter table storage.objects enable row level security;
      grant usage on schema storage to authenticated;
      grant select, insert, delete on storage.objects to authenticated;
    `)
    for (const file of [
      'schema.sql',
      'doctor-sharing.sql',
      'health-professionals.sql',
      'phase2-clinical.sql',
      'phase11-cgm-pilot.sql',
      'phase11-cgm-pilot-indexes.sql',
      'phase11-cgm-pilot-audit-race.sql',
      'phase11-cgm-patient-history-cap.sql',
      'phase11a-libre-pdf.sql',
      'phase11a-libre-pdf-acl.sql',
      'phase11a-libre-pdf-indexes.sql',
    ]) {
      try {
        await db.exec(
          'begin;\n' + (await readFile(new URL(`supabase/${file}`, root), 'utf8')) + '\ncommit;',
        )
      } catch (error) {
        throw new Error(`${file}: ${error.message} (${JSON.stringify(error)})`)
      }
    }

    async function sql(query, params = []) {
      return (await db.query(query, params)).rows
    }
    async function as(id, action, role = 'authenticated') {
      await db.exec('savepoint actor_scope')
      try {
        await db.query("select set_config('request.jwt.claim.sub', $1, true)", [id ?? ''])
        await db.exec(`set local role ${role}`)
        const result = await action()
        await db.exec('reset role; release savepoint actor_scope')
        return result
      } catch (error) {
        await db.exec('rollback to savepoint actor_scope; release savepoint actor_scope')
        throw error
      }
    }
    async function rpc(name, args = []) {
      const actor = (await sql('select auth.uid() as actor'))[0].actor
      const values = actorScopedRpcs.has(name) ? [actor, ...args] : args
      const placeholders = values.map((_, index) => `$${index + 1}`).join(',')
      return (await sql(`select public.${name}(${placeholders}) as result`, values))[0].result
    }
    async function fixture() {
      const [patient, stranger, doctor, secondDoctor] = Array.from({ length: 4 }, randomUUID)
      for (const id of [patient, stranger, doctor, secondDoctor]) {
        await db.query(
          'insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)',
          [id, `${id}@example.invalid`, { full_name: 'Synthetic CGM account' }],
        )
      }
      for (const id of [doctor, secondDoctor]) {
        await db.query(
          "insert into public.doctor_profiles (user_id, professional_name, crm, crm_state) values ($1, 'Synthetic physician', '12345', 'SP')",
          [id],
        )
      }
      return { patient, stranger, doctor, secondDoctor }
    }
    async function activateDiabetes(patient, doctor) {
      await as(patient, () => rpc('endo_grant_doctor_access', [doctor, 30]))
      await as(patient, () => rpc('endo_grant_clinical_activation', [doctor, randomUUID(), true]))
      await as(doctor, () => rpc('endo_configure_clinical_module', [
        patient, 'diabetes', null, randomUUID(), { low: 70, high: 180 },
      ]))
    }
    const firstTimestamp = new Date(Date.now() - 86400000).toISOString()
    const secondTimestamp = new Date(Date.parse(firstTimestamp) + 15 * 60000).toISOString()
    const readings = [
      { occurred_at: firstTimestamp, value_mg_dl: 110, kind: 'automatic' },
      { occurred_at: secondTimestamp, value_mg_dl: 125.5, kind: 'scanned' },
      { occurred_at: secondTimestamp, value_mg_dl: 125.5, kind: 'scanned' },
    ]

    await t.test('consent is explicit, persisted, versioned and idempotent; imports are normalized and deduplicated', async () => {
      await db.exec('begin')
      try {
        const { patient, stranger } = await fixture()
        await assert.rejects(
          as(patient, () => rpc('endo_grant_cgm_consent', [source, randomUUID(), consentVersion, false])),
          /Explicit consent is required/,
        )
        const consentRequest = randomUUID()
        const consent = await as(patient, () => rpc('endo_grant_cgm_consent', [source, consentRequest, consentVersion, true]))
        assert.equal(consent.patient_id, patient)
        assert.equal(consent.revoked_at, null)
        await as(patient, () => rpc('endo_grant_cgm_consent', [source, consentRequest, consentVersion, true]))
        const importRequest = randomUUID()
        const batch = await as(patient, () => rpc('endo_import_cgm_readings', [
          source, importRequest, 'America/Sao_Paulo', parserVersion, readings,
        ]))
        assert.equal(batch.submitted_rows, 3)
        assert.equal(batch.inserted_rows, 2)
        assert.equal(batch.duplicate_rows, 1)
        const replay = await as(patient, () => rpc('endo_import_cgm_readings', [
          source, importRequest, 'America/Sao_Paulo', parserVersion, readings,
        ]))
        assert.equal(replay.id, batch.id)
        assert.equal((await as(patient, () => sql('select * from public.patient_cgm_readings'))).length, 2)
        assert.equal((await as(stranger, () => sql('select * from public.patient_cgm_readings'))).length, 0)
        await assert.rejects(
          as(patient, () => db.exec('insert into public.patient_cgm_readings (patient_id, import_id, consent_request_id, source_key, occurred_at, time_zone, glucose_mg_dl, reading_type) values (\'00000000-0000-0000-0000-000000000000\', \'00000000-0000-0000-0000-000000000000\', \'00000000-0000-0000-0000-000000000000\', \'libreview_csv\', now(), \'UTC\', 100, \'automatic\')')),
          /permission denied/,
        )
      } finally {
        await db.exec('rollback')
      }
    })

    await t.test('physicians need current sharing, active diabetes module and current source consent; every page read is audited', async () => {
      await db.exec('begin')
      try {
        const { patient, stranger, doctor, secondDoctor } = await fixture()
        await as(patient, () => rpc('endo_grant_cgm_consent', [source, randomUUID(), consentVersion, true]))
        await as(patient, () => rpc('endo_import_cgm_readings', [source, randomUUID(), 'America/Sao_Paulo', parserVersion, readings]))
        const pageArgs = [patient, randomUUID(), null, null, 500]
        await assert.rejects(as(doctor, () => rpc('endo_doctor_cgm_page', pageArgs)), /Active patient sharing required/)
        await as(patient, () => rpc('endo_grant_doctor_access', [doctor, 30]))
        await assert.rejects(as(doctor, () => rpc('endo_doctor_cgm_page', pageArgs)), /Active diabetes module required/)
        await as(patient, () => rpc('endo_grant_clinical_activation', [doctor, randomUUID(), true]))
        await as(doctor, () => rpc('endo_configure_clinical_module', [patient, 'diabetes', null, randomUUID(), { low: 70, high: 180 }]))
        const rows = await as(doctor, () => rpc('endo_doctor_cgm_page', pageArgs))
        assert.equal(rows.length, 2)
        assert.equal((await as(doctor, () => sql('select * from public.patient_cgm_readings'))).length, 0)
        await assert.rejects(as(doctor, () => rpc('endo_doctor_cgm_page', pageArgs)), /already used/)
        assert.equal((await as(patient, () => sql('select * from public.patient_cgm_access_logs'))).length, 1)
        assert.equal((await as(doctor, () => sql('select * from public.patient_cgm_access_logs'))).length, 0)
        await assert.rejects(
          as(secondDoctor, () => rpc('endo_doctor_cgm_page', [patient, randomUUID(), null, null, 500])),
          /Active patient sharing required/,
        )
        await as(patient, () => rpc('endo_revoke_cgm_consent', [source, randomUUID()]))
        await assert.rejects(
          as(doctor, () => rpc('endo_doctor_cgm_page', [patient, randomUUID(), null, null, 500])),
          /Active CGM source consent required/,
        )
        assert.equal((await as(patient, () => sql('select * from public.patient_cgm_readings'))).length, 2)
        await as(patient, () => rpc('endo_grant_cgm_consent', [source, randomUUID(), consentVersion, true]))
        assert.deepEqual(await as(doctor, () => rpc('endo_doctor_cgm_page', [patient, randomUUID(), null, null, 500])), [])
        await as(patient, () => rpc('endo_import_cgm_readings', [source, randomUUID(), 'America/Sao_Paulo', parserVersion, readings]))
        assert.equal((await as(doctor, () => rpc('endo_doctor_cgm_page', [patient, randomUUID(), null, null, 500]))).length, 2)
        await as(patient, () => rpc('endo_revoke_doctor_access', [doctor]))
        await assert.rejects(
          as(doctor, () => rpc('endo_doctor_cgm_page', [patient, randomUUID(), null, null, 500])),
          /Active patient sharing required/,
        )
      } finally {
        await db.exec('rollback')
      }
    })

    await t.test('revocation blocks professional reads; patient deletion removes readings but retains the audit event', async () => {
      await db.exec('begin')
      try {
        const { patient } = await fixture()
        await as(patient, () => rpc('endo_grant_cgm_consent', [source, randomUUID(), consentVersion, true]))
        await as(patient, () => rpc('endo_import_cgm_readings', [source, randomUUID(), 'America/Sao_Paulo', parserVersion, readings]))
        await assert.rejects(
          as(patient, () => rpc('endo_delete_cgm_imports', [source, randomUUID(), false])),
          /Explicit deletion confirmation is required/,
        )
        const request = randomUUID()
        const result = await as(patient, () => rpc('endo_delete_cgm_imports', [source, request, true]))
        assert.equal(result.deleted, 2)
        assert.equal((await as(patient, () => sql('select * from public.patient_cgm_readings'))).length, 0)
        assert.equal((await as(patient, () => sql('select * from public.patient_cgm_imports'))).length, 0)
        const event = (await as(patient, () => sql("select * from public.patient_cgm_consent_events where request_id = $1", [request])))[0]
        assert.equal(event.action, 'data_deleted')
        assert.equal(event.rows_affected, 2)
      } finally {
        await db.exec('rollback')
      }
    })

    await t.test('PDF consent is separate; reports store only AGP metrics and require audited access', async () => {
      await db.exec('begin')
      try {
        const pdfFunctionPermissions = await sql(`
          select
            has_function_privilege('authenticated', 'endo_private.cgm_register_pdf_report(uuid,uuid,text,text,text,jsonb)', 'EXECUTE') as internal_execute,
            has_function_privilege('authenticated', 'public.endo_register_cgm_pdf_report(uuid,uuid,uuid,text,text,text,jsonb)', 'EXECUTE') as rpc_execute
        `)
        assert.equal(pdfFunctionPermissions[0].internal_execute, true)
        assert.equal(pdfFunctionPermissions[0].rpc_execute, true)
        const { patient, stranger, doctor } = await fixture()
        const consentRequest = randomUUID()
        await assert.rejects(
          as(patient, () => rpc('endo_grant_cgm_consent', [pdfSource, consentRequest, pdfConsentVersion, false])),
          /Explicit consent is required/,
        )
        await as(patient, () => rpc('endo_grant_cgm_consent', [pdfSource, consentRequest, pdfConsentVersion, true]))
        const metrics = {
          language: 'pt', periodStart: '2025-09-13', periodEnd: '2025-09-26',
          sensorActivePercent: 63, timeVeryHighPercent: 2, timeHighPercent: 8,
          timeInRangePercent: 78, timeLowPercent: 10, timeVeryLowPercent: 2,
          meanGlucoseMgDl: 145, gmiPercent: 6.7, gmiMmolMol: 50,
          coefficientVariationPercent: 34.5, device: 'FreeStyle Libre 3',
        }
        const reportId = randomUUID()
        const reportRequest = randomUUID()
        const path = `${patient}/${reportId}.pdf`
        await as(patient, () => db.query(
          "insert into storage.objects (bucket_id, name, owner_id) values ('endo-cgm-libre-pdf', $1, $2)",
          [path, patient],
        ))
        await assert.rejects(
          as(patient, () => db.query(
            "insert into storage.objects (bucket_id, name, owner_id) values ('endo-cgm-libre-pdf', $1, $2)",
            [`${stranger}/${randomUUID()}.pdf`, patient],
          )),
          /row-level security policy/,
        )
        const saved = await as(patient, () => rpc('endo_register_cgm_pdf_report', [
          reportId, reportRequest, path, pdfParserVersion, 'recognized', metrics,
        ]))
        assert.equal(saved.patient_id, patient)
        assert.equal(saved.sensor_active_percent, 63)
        assert.equal(saved.time_in_range_percent, 78)
        assert.equal((await as(patient, () => sql('select * from public.patient_cgm_pdf_reports'))).length, 1)
        assert.equal((await as(stranger, () => sql('select * from public.patient_cgm_pdf_reports'))).length, 0)
        assert.equal((await as(patient, () => sql('select * from storage.objects'))).length, 0)
        await assert.rejects(
          as(patient, () => sql(
            'insert into public.patient_cgm_pdf_reports (id, patient_id, consent_request_id, request_id, storage_path, parse_status, parser_version) values ($1, $2, $3, $4, $5, $6, $7)',
            [randomUUID(), patient, consentRequest, randomUUID(), `${patient}/${randomUUID()}.pdf`, 'unrecognized', pdfParserVersion],
          )),
          /permission denied/,
        )
        const invalidReportId = randomUUID()
        const invalidPath = `${patient}/${invalidReportId}.pdf`
        await as(patient, () => db.query(
          "insert into storage.objects (bucket_id, name, owner_id) values ('endo-cgm-libre-pdf', $1, $2)",
          [invalidPath, patient],
        ))
        await assert.rejects(
          as(patient, () => rpc('endo_register_cgm_pdf_report', [
            invalidReportId, randomUUID(), invalidPath, pdfParserVersion,
            'recognized', { ...metrics, patientName: 'Sensitive Name' },
          ])),
          /Incomplete or unexpected LibreView metrics/,
        )

        const unrecognizedId = randomUUID()
        const unrecognizedPath = `${patient}/${unrecognizedId}.pdf`
        await as(patient, () => db.query(
          "insert into storage.objects (bucket_id, name, owner_id) values ('endo-cgm-libre-pdf', $1, $2)",
          [unrecognizedPath, patient],
        ))
        const unrecognized = await as(patient, () => rpc('endo_register_cgm_pdf_report', [
          unrecognizedId, randomUUID(), unrecognizedPath, pdfParserVersion, 'unrecognized', {},
        ]))
        assert.equal(unrecognized.parse_status, 'unrecognized')
        assert.equal(unrecognized.period_start, null)

        const doctorRequest = randomUUID()
        await activateDiabetes(patient, doctor)
        const doctorReports = await as(doctor, () => rpc('endo_doctor_cgm_pdf_page', [patient, doctorRequest]))
        assert.equal(doctorReports.length, 2)
        assert.equal((await as(patient, () => sql("select * from public.patient_cgm_pdf_access_logs where action = 'metadata'"))).length, 1)
        await assert.rejects(
          as(doctor, () => rpc('endo_doctor_cgm_pdf_page', [patient, doctorRequest])),
          /already used/,
        )

        const fileRequest = randomUUID()
        const authorizedPath = await as(doctor, () => rpc('endo_authorize_cgm_pdf_file_access', [reportId, fileRequest, 'read']))
        assert.equal(authorizedPath, path)
        await assert.rejects(
          as(doctor, () => rpc('endo_authorize_cgm_pdf_file_access', [reportId, fileRequest, 'read'])),
          /already used/,
        )
        assert.equal((await as(patient, () => sql("select * from public.patient_cgm_pdf_access_logs where action = 'file'"))).length, 1)
        await as(patient, () => rpc('endo_revoke_cgm_consent', [pdfSource, randomUUID()]))
        await assert.rejects(
          as(doctor, () => rpc('endo_authorize_cgm_pdf_file_access', [reportId, randomUUID(), 'read'])),
          /Active PDF consent required/,
        )

        await as(patient, () => rpc('endo_grant_cgm_consent', [pdfSource, randomUUID(), pdfConsentVersion, true]))
        const deleteRequest = randomUUID()
        const staged = await as(patient, () => rpc('endo_stage_delete_cgm_pdf_reports', [deleteRequest]))
        assert.equal(staged.count, 2)
        assert.equal(staged.paths.length, 2)
        assert.equal((await as(patient, () => sql('select * from public.patient_cgm_pdf_reports'))).length, 0)
        await db.query("delete from storage.objects where bucket_id = 'endo-cgm-libre-pdf' and name = any($1::text[])", [staged.paths])
        const finalized = await as(patient, () => rpc('endo_finalize_delete_cgm_pdf_reports', [deleteRequest]))
        assert.equal(finalized.deleted, 2)
        assert.equal((await as(patient, () => sql('select * from public.patient_cgm_pdf_reports'))).length, 0)
        const replay = await as(patient, () => rpc('endo_stage_delete_cgm_pdf_reports', [deleteRequest]))
        assert.equal(replay.already_deleted, true)
        assert.equal((await as(patient, () => sql("select * from public.patient_cgm_consent_events where request_id = $1", [deleteRequest])))[0].action, 'data_deleted')
      } finally {
        await db.exec('rollback')
      }
    })

    await t.test('patient history limit prevents imports from hiding consent and deletion controls', async () => {
      await db.exec('begin')
      try {
        const { patient } = await fixture()
        await as(patient, () => rpc('endo_grant_cgm_consent', [source, randomUUID(), consentVersion, true]))
        const baseTime = Date.now() - 25000 * 1000
        const maximumReadings = Array.from({ length: 25000 }, (_, index) => ({
          occurred_at: new Date(baseTime + index * 1000).toISOString(),
          value_mg_dl: 100 + (index % 50),
          kind: 'automatic',
        }))
        const batch = await as(patient, () => rpc('endo_import_cgm_readings', [
          source, randomUUID(), 'America/Sao_Paulo', parserVersion, maximumReadings,
        ]))
        assert.equal(batch.inserted_rows, 25000)
        const extraReading = [{
          occurred_at: new Date(Date.now() - 86400000).toISOString(),
          value_mg_dl: 999,
          kind: 'scanned',
        }]
        await assert.rejects(
          as(patient, () => rpc('endo_import_cgm_readings', [
            source, randomUUID(), 'America/Sao_Paulo', parserVersion, extraReading,
          ])),
          /CGM patient history limit exceeded/,
        )
        assert.equal((await as(patient, () => sql('select * from public.patient_cgm_readings'))).length, 25000)
        assert.equal((await as(patient, () => sql('select * from public.patient_cgm_imports'))).length, 1)
      } finally {
        await db.exec('rollback')
      }
    })
  } finally {
    await db.close()
  }
})
