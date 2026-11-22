import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { createClinicalRepository } from '../../src/services/clinicalRepository.js'
import { dateBefore } from '../../src/lib/patientData.js'

const root = new URL('../../', import.meta.url)
const tables = [
  'patient_module_permissions',
  'clinical_module_settings',
  'clinical_module_versions',
  'glucose_readings',
  'hypoglycemia_events',
  'hba1c_results',
  'injection_logs',
  'gi_symptom_logs',
  'thyroid_intakes',
  'blood_pressure_readings',
  'clinical_record_corrections',
]
const at = new Date(Date.now() - 86400000).toISOString()
const date = at.slice(0, 10)
const timed = (fields) => ({
  occurred_at: at,
  time_zone: 'America/Sao_Paulo',
  ...fields,
})

test(
  'isolated PostgreSQL clinical integration',
  { timeout: 90000 },
  async (t) => {
    const db = new PGlite({ extensions: { pgcrypto } })
    try {
      await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key, aud text, role text, email text, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
      grant usage on schema auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
    `)
      for (const file of [
        'schema.sql',
        'doctor-sharing.sql',
        'doctor-code-customization.sql',
        'health-professionals.sql',
        'phase2-clinical.sql',
        'phase2-corrections.sql',
      ]) {
        try {
          await db.exec(
            'begin;\n' +
              (await readFile(new URL('supabase/' + file, root), 'utf8')) +
              '\ncommit;',
          )
        } catch (error) {
          throw new Error(`${file}: ${error.message}`)
        }
      }
      const version = (await db.query('select version() as version')).rows[0]
        .version
      t.diagnostic(version)
      await t.test(
        'conflict repair is idempotent and preserves function privileges',
        async () => {
          const selector = `select p.oid, p.proname, p.proacl::text, p.prosecdef, p.proconfig
          from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
          where n.nspname='endo_private' and p.proname in ('clinical_grant','clinical_configure','clinical_close','clinical_lock_module','clinical_save') order by p.proname`
          const before = (await db.query(selector)).rows
          assert.equal(before.length, 5)
          // Reproduce the prior installation, then exercise its in-place repair twice.
          for (const row of before) {
            const definition = (
              await db.query(
                'select pg_get_functiondef($1::oid) as definition',
                [row.oid],
              )
            ).rows[0].definition
            assert.ok(definition.includes("errcode = 'PT409'"))
            await db.exec(
              definition.replaceAll("errcode = 'PT409'", "errcode = '40001'"),
            )
          }
          const repair = await readFile(
            new URL('supabase/phase2-conflict-response.sql', root),
            'utf8',
          )
          await db.exec(repair)
          await db.exec(repair)
          assert.deepEqual((await db.query(selector)).rows, before)
          for (const row of before) {
            const definition = (
              await db.query(
                'select pg_get_functiondef($1::oid) as definition',
                [row.oid],
              )
            ).rows[0].definition
            assert.ok(definition.includes("errcode = 'PT409'"))
            assert.ok(!definition.includes("errcode = '40001'"))
          }
        },
      )
      async function as(id, action, role = 'authenticated') {
        await db.exec('savepoint actor_scope')
        try {
          await db.query(
            "select set_config('request.jwt.claim.sub', $1, true)",
            [id ?? ''],
          )
          await db.exec(`set local role ${role}`)
          const result = await action()
          await db.exec('reset role; release savepoint actor_scope')
          return result
        } catch (error) {
          await db.exec(
            'rollback to savepoint actor_scope; release savepoint actor_scope',
          )
          throw error
        }
      }
      async function sql(query, params = []) {
        return (await db.query(query, params)).rows
      }
      async function rpc(name, values = []) {
        if (
          [
            'endo_grant_clinical_activation',
            'endo_revoke_clinical_activation',
            'endo_configure_clinical_module',
            'endo_close_clinical_module',
            'endo_save_clinical_record',
            'endo_correct_clinical_record',
          ].includes(name)
        ) {
          const actor = (await sql('select auth.uid() as actor'))[0].actor
          values = [actor, ...values]
        }
        const args = values.map((_, i) => `$${i + 1}`).join(',')
        return (
          await sql(`select public.${name}(${args}) as result`, values)
        )[0].result
      }
      async function fixture() {
        const [patient, stranger, doctor, second, nutritionist] = Array.from(
          { length: 5 },
          randomUUID,
        )
        for (const id of [patient, stranger, doctor, second, nutritionist])
          await db.query(
            'insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,$3)',
            [
              id,
              `${id}@example.invalid`,
              { full_name: 'Synthetic clinical account', role: 'doctor' },
            ],
          )
        for (const id of [doctor, second])
          await db.query(
            "insert into public.doctor_profiles(user_id,professional_name,crm,crm_state) values ($1,'Synthetic physician','12345','SP')",
            [id],
          )
        await db.query(
          "insert into public.doctor_profiles(user_id,professional_name,profession,council,crm,crm_state) values ($1,'Synthetic nutritionist','Nutrição','CRN','12345','SP')",
          [nutritionist],
        )
        async function share(id = doctor) {
          await as(patient, () => rpc('endo_grant_doctor_access', [id, 30]))
        }
        async function grant(id = doctor, request = randomUUID()) {
          return as(patient, () =>
            rpc('endo_grant_clinical_activation', [id, request, true]),
          )
        }
        async function configure(
          module = 'diabetes',
          config = { low: 80, high: 180 },
          expected = null,
          id = doctor,
          request = randomUUID(),
        ) {
          return as(id, () =>
            rpc('endo_configure_clinical_module', [
              patient,
              module,
              expected,
              request,
              config,
            ]),
          )
        }
        async function save(
          kind,
          values,
          versionId,
          request = randomUUID(),
          id = patient,
        ) {
          return as(id, () =>
            rpc('endo_save_clinical_record', [
              kind,
              versionId,
              request,
              values,
            ]),
          )
        }
        async function correct(
          kind,
          record,
          values,
          reason = 'Erro de digitação',
          request = randomUUID(),
          actor = patient,
        ) {
          return as(actor, () =>
            rpc('endo_correct_clinical_record', [
              kind,
              record,
              request,
              reason,
              values,
            ]),
          )
        }
        return {
          patient,
          stranger,
          doctor,
          second,
          nutritionist,
          share,
          grant,
          configure,
          save,
          correct,
        }
      }
      async function scenario(title, body) {
        await t.test(title, async () => {
          await db.exec('begin')
          try {
            await body(await fixture())
            await db.exec('set constraints all immediate')
          } finally {
            await db.exec('rollback')
          }
        })
      }
      async function denied(action, code = '42501') {
        // A savepoint lets each expected denial leave the surrounding scenario usable.
        await db.exec('savepoint expected_denial')
        let failure
        try {
          await action()
        } catch (error) {
          failure = error
        }
        await db.exec('rollback to savepoint expected_denial')
        assert.ok(failure, 'Expected the database to reject this operation')
        if (code) assert.equal(failure.code, code)
      }

      await scenario(
        'anonymous roles have no table or function access; every new table enforces RLS',
        async () => {
          for (const name of tables) {
            const [row] = await sql(
              'select relrowsecurity from pg_class where oid = $1::regclass',
              ['public.' + name],
            )
            assert.equal(row.relrowsecurity, true)
            await denied(() =>
              as(null, () => sql(`select * from public.${name}`), 'anon'),
            )
          }
          const functions = await sql(
            "select p.oid::regprocedure::text as signature, has_function_privilege('anon',p.oid,'execute') as anonymous from pg_proc p join pg_namespace n on n.oid = p.pronamespace where (n.nspname='endo_private' and p.proname like 'clinical_%') or (n.nspname='public' and p.proname like 'endo_%clinical%')",
          )
          assert.ok(functions.length > 8)
          assert.ok(functions.every((row) => !row.anonymous))
          const [trigger] = await sql(
            "select has_function_privilege('authenticated','endo_private.clinical_invalidate_activation()','execute') as allowed",
          )
          assert.equal(trigger.allowed, false)
        },
      )
      await scenario(
        'read-only sharing never authorizes activation; the patient must consent separately',
        async (f) => {
          await f.share()
          await denied(() => f.configure())
          await denied(() =>
            as(f.patient, () =>
              sql(
                'select public.endo_grant_clinical_activation($1,$2,$3,true)',
                [f.stranger, f.doctor, randomUUID()],
              ),
            ),
          )
          await denied(() =>
            as(f.patient, () =>
              rpc('endo_grant_clinical_activation', [
                f.doctor,
                randomUUID(),
                false,
              ]),
            ),
          )
          await denied(() =>
            as(f.doctor, () =>
              rpc('endo_grant_clinical_activation', [
                f.doctor,
                randomUUID(),
                true,
              ]),
            ),
          )
          const request = randomUUID()
          const first = await f.grant(f.doctor, request)
          assert.equal(await f.grant(f.doctor, request), first)
          const version = await f.configure()
          assert.equal(version.patient_id, f.patient)
          await denied(() =>
            as(f.patient, () =>
              rpc('endo_configure_clinical_module', [
                f.patient,
                'thyroid',
                null,
                randomUUID(),
                {},
              ]),
            ),
          )
        },
      )
      await scenario(
        'other professions and forged JWT metadata do not gain physician configuration rights',
        async (f) => {
          await f.share(f.nutritionist)
          await denied(() => f.grant(f.nutritionist))
          await denied(() => f.configure('thyroid', {}, null, f.nutritionist))
          await f.share()
          await f.grant()
          await denied(() =>
            as(f.stranger, () =>
              rpc('endo_configure_clinical_module', [
                f.patient,
                'thyroid',
                null,
                randomUUID(),
                {},
              ]),
            ),
          )
        },
      )
      await scenario(
        'all seven record types persist typed values, zones and patient ownership',
        async (f) => {
          await f.share()
          await f.grant()
          const diabetes = await f.configure()
          const glp1 = await f.configure('glp1', {
            medication: 'Semaglutida',
            dose_mg: 1,
            interval_days: 7,
            anchor_date: '2020-01-01',
          })
          const thyroid = await f.configure('thyroid', {})
          const pressure = await f.configure('pressure', {})
          const inputs = [
            ['glucose', timed({ value: 110, context: 'fasting' }), diabetes.id],
            [
              'hypoglycemia',
              timed({
                value: null,
                symptoms: 'Synthetic symptom',
                action_taken: 'Synthetic action',
              }),
              diabetes.id,
            ],
            [
              'hba1c',
              { occurred_on: date, time_zone: 'America/Sao_Paulo', value: 6.8 },
              diabetes.id,
            ],
            ['injection', timed({ site: 'abdomen' }), glp1.id],
            [
              'gi',
              timed({
                nausea: 1,
                vomiting: 0,
                constipation: 0,
                diarrhea: 0,
                reflux: 3,
              }),
              glp1.id,
            ],
            ['thyroid', timed({ fasting: 'unsure' }), thyroid.id],
            [
              'pressure',
              timed({ systolic: 120, diastolic: 80, pulse: null }),
              pressure.id,
            ],
          ]
          for (const [kind, values, versionId] of inputs) {
            const request = randomUUID()
            const row = await f.save(kind, values, versionId, request)
            assert.equal(row.patient_id, f.patient)
            assert.equal(row.module_version_id, versionId)
            assert.equal(row.time_zone, 'America/Sao_Paulo')
            assert.equal(
              (await f.save(kind, values, versionId, request)).id,
              row.id,
            )
          }
          await denied(
            () =>
              f.save(
                'glucose',
                timed({
                  value: 110,
                  context: 'fasting',
                  patient_id: f.stranger,
                }),
                diabetes.id,
              ),
            '22023',
          )
        },
      )
      await scenario(
        'new records and consent rows are isolated; authorized nonmedical readers still cannot edit',
        async (f) => {
          await f.share()
          await f.grant()
          const v = await f.configure()
          await f.save('glucose', timed({ value: 100, context: 'other' }), v.id)
          assert.equal(
            (
              await as(f.stranger, () =>
                sql('select * from public.glucose_readings'),
              )
            ).length,
            0,
          )
          assert.equal(
            (
              await as(f.doctor, () =>
                sql('select * from public.glucose_readings'),
              )
            ).length,
            1,
          )
          await f.share(f.nutritionist)
          assert.equal(
            (
              await as(f.nutritionist, () =>
                sql('select * from public.glucose_readings'),
              )
            ).length,
            1,
          )
          for (const id of [f.patient, f.doctor, f.nutritionist]) {
            await denied(() =>
              as(id, () =>
                sql('update public.glucose_readings set value = 999'),
              ),
            )
            await denied(() =>
              as(id, () => sql('delete from public.clinical_module_versions')),
            )
          }
          await denied(() =>
            as(f.stranger, () => rpc('endo_clinical_overview', [f.patient])),
          )
          await denied(() =>
            f.save(
              'glucose',
              timed({ value: 99, context: 'other' }),
              v.id,
              randomUUID(),
              f.doctor,
            ),
          )
        },
      )
      await scenario(
        'revoking activation keeps reading/history; renewing consent cannot revive a module',
        async (f) => {
          await f.share()
          await f.grant()
          const v = await f.configure()
          await f.save('glucose', timed({ value: 100, context: 'other' }), v.id)
          await as(f.patient, () =>
            rpc('endo_revoke_clinical_activation', [f.doctor]),
          )
          assert.equal(
            (
              await as(f.doctor, () =>
                sql('select * from public.glucose_readings'),
              )
            ).length,
            1,
          )
          await denied(() =>
            f.save('glucose', timed({ value: 110, context: 'other' }), v.id),
          )
          await f.grant()
          const overview = await as(f.patient, () =>
            rpc('endo_clinical_overview', [f.patient]),
          )
          assert.equal(overview.modules[0].active, false)
          await denied(() =>
            f.save('glucose', timed({ value: 110, context: 'other' }), v.id),
          )
          await f.configure('diabetes', { low: 80, high: 180 }, v.id)
          assert.equal(
            (
              await as(f.patient, () =>
                rpc('endo_clinical_overview', [f.patient]),
              )
            ).modules[0].active,
            true,
          )
        },
      )
      await scenario(
        'core sharing revocation/expiry blocks reading and activation, including same-timestamp renewals',
        async (f) => {
          await f.share()
          await f.grant()
          const v = await f.configure()
          await f.save('glucose', timed({ value: 100, context: 'other' }), v.id)
          await as(f.patient, () =>
            rpc('endo_revoke_doctor_access', [f.doctor]),
          )
          assert.equal(
            (
              await as(f.doctor, () =>
                sql('select * from public.glucose_readings'),
              )
            ).length,
            0,
          )
          await denied(() =>
            as(f.doctor, () => rpc('endo_clinical_overview', [f.patient])),
          )
          await f.share()
          assert.equal(
            (
              await as(f.patient, () =>
                rpc('endo_clinical_overview', [f.patient]),
              )
            ).modules[0].active,
            false,
          )
          await f.grant()
          const current = await f.configure('diabetes', {}, v.id)
          await db.query(
            "update public.patient_shares set granted_at = now() - interval '2 days', expires_at = now() - interval '1 day' where patient_id=$1 and doctor_id=$2",
            [f.patient, f.doctor],
          )
          await denied(() =>
            f.save(
              'glucose',
              timed({ value: 100, context: 'other' }),
              current.id,
            ),
          )
          assert.equal(
            (
              await as(f.doctor, () =>
                sql('select * from public.glucose_readings'),
              )
            ).length,
            0,
          )
        },
      )
      await scenario(
        'independent physicians cannot overwrite ownership and a patient controls transfer',
        async (f) => {
          await f.share()
          await f.grant()
          const first = await f.configure('thyroid', {})
          await f.share(f.second)
          await f.grant(f.second)
          await denied(() => f.configure('thyroid', {}, first.id, f.second))
          await f.configure('pressure', {}, null, f.second)
          await as(f.patient, () =>
            rpc('endo_close_clinical_module', ['thyroid', first.id]),
          )
          const second = await f.configure('thyroid', {}, first.id, f.second)
          assert.equal(second.doctor_id, f.second)
          await denied(() => f.configure('thyroid', {}, second.id))
        },
      )
      await scenario(
        'plan revisions preserve old doses and reject stale version writes or reused requests',
        async (f) => {
          await f.share()
          await f.grant()
          const plan = {
            medication: 'Semaglutida',
            dose_mg: 1,
            interval_days: 7,
            anchor_date: '2020-01-01',
          }
          const request = randomUUID()
          const first = await f.configure('glp1', plan, null, f.doctor, request)
          assert.equal(
            (await f.configure('glp1', plan, null, f.doctor, request)).id,
            first.id,
          )
          const old = await f.save(
            'injection',
            timed({ site: 'thigh' }),
            first.id,
          )
          const second = await f.configure(
            'glp1',
            { ...plan, dose_mg: 2 },
            first.id,
          )
          const [row] = await as(f.patient, () =>
            sql(
              'select v.dose_mg from public.injection_logs i join public.clinical_module_versions v on v.id=i.module_version_id where i.id=$1',
              [old.id],
            ),
          )
          assert.equal(Number(row.dose_mg), 1)
          await denied(
            () => f.save('injection', timed({ site: 'arm' }), first.id),
            'PT409',
          )
          await denied(() => f.configure('glp1', plan, first.id), 'PT409')
          await denied(
            () => f.configure('glp1', plan, null, f.doctor, request),
            'PT409',
          )
          const id = randomUUID()
          await f.save('injection', timed({ site: 'arm' }), second.id, id)
          await denied(
            () =>
              f.save('injection', timed({ site: 'abdomen' }), second.id, id),
            'PT409',
          )
        },
      )
      await scenario(
        'invalid values, zones, offsets, fractions and future dates are rejected atomically',
        async (f) => {
          await f.share()
          await f.grant()
          const d = await f.configure()
          const g = await f.configure('glp1', {
            medication: 'Tirzepatida',
            dose_mg: 2.5,
            interval_days: 7,
            anchor_date: '2020-01-01',
          })
          const p = await f.configure('pressure', {})
          const invalid = [
            ['glucose', timed({ value: 0, context: 'fasting' }), d.id],
            ['glucose', timed({ value: 'NaN', context: 'fasting' }), d.id],
            ['glucose', timed({ value: 100, context: 'unknown' }), d.id],
            [
              'glucose',
              {
                ...timed({ value: 100, context: 'fasting' }),
                time_zone: 'not/a/zone',
              },
              d.id,
            ],
            [
              'glucose',
              {
                ...timed({ value: 100, context: 'fasting' }),
                occurred_at: '2020-01-01T10:00:00',
              },
              d.id,
            ],
            [
              'glucose',
              {
                ...timed({ value: 100, context: 'fasting' }),
                occurred_at: '2099-01-01T10:00:00Z',
              },
              d.id,
            ],
            [
              'hba1c',
              { occurred_on: '2099-01-01', time_zone: 'UTC', value: 6.8 },
              d.id,
            ],
            [
              'gi',
              timed({
                nausea: 1.5,
                vomiting: 0,
                constipation: 0,
                diarrhea: 0,
                reflux: 0,
              }),
              g.id,
            ],
            ['pressure', timed({ systolic: 80, diastolic: 120 }), p.id],
            ['injection', timed({ site: 'unknown' }), g.id],
          ]
          for (const [kind, values, id] of invalid)
            await denied(() => f.save(kind, values, id), null)
          assert.equal(
            (
              await as(f.patient, () =>
                sql('select * from public.glucose_readings'),
              )
            ).length,
            0,
          )
          await denied(
            () =>
              f.configure(
                'glp1',
                {
                  medication: 'Tirzepatida',
                  dose_mg: 2.5,
                  interval_days: 1.5,
                  anchor_date: '2020-01-01',
                },
                g.id,
              ),
            '22023',
          )
          assert.equal(
            (
              await as(f.patient, () =>
                rpc('endo_clinical_overview', [f.patient]),
              )
            ).modules.find((m) => m.module_key === 'glp1').current_version_id,
            g.id,
          )
        },
      )
      await scenario(
        'all seven correction types append typed records and retain the original author, values and version',
        async (f) => {
          await f.share()
          await f.grant()
          const versions = {}
          versions.diabetes = await f.configure()
          versions.glp1 = await f.configure('glp1', {
            medication: 'Semaglutida',
            dose_mg: 1,
            interval_days: 7,
            anchor_date: '2020-01-01',
          })
          versions.thyroid = await f.configure('thyroid', {})
          versions.pressure = await f.configure('pressure', {})
          const cases = [
            [
              'glucose',
              'glucose_readings',
              'diabetes',
              timed({ value: 110, context: 'fasting' }),
              { value: 120 },
            ],
            [
              'hypoglycemia',
              'hypoglycemia_events',
              'diabetes',
              timed({
                value: null,
                symptoms: 'Sintoma fictício',
                action_taken: 'Ação fictícia',
              }),
              { value: 65 },
            ],
            [
              'hba1c',
              'hba1c_results',
              'diabetes',
              { occurred_on: date, time_zone: 'UTC', value: 6.8 },
              { value: 6.9 },
            ],
            [
              'injection',
              'injection_logs',
              'glp1',
              timed({ site: 'arm' }),
              { site: 'thigh' },
            ],
            [
              'gi',
              'gi_symptom_logs',
              'glp1',
              timed({
                nausea: 0,
                vomiting: 0,
                constipation: 0,
                diarrhea: 0,
                reflux: 0,
              }),
              { nausea: 1 },
            ],
            [
              'thyroid',
              'thyroid_intakes',
              'thyroid',
              timed({ fasting: 'yes' }),
              { fasting: 'no' },
            ],
            [
              'pressure',
              'blood_pressure_readings',
              'pressure',
              timed({ systolic: 120, diastolic: 80, pulse: null }),
              { systolic: 125 },
            ],
          ]
          for (const [kind, table, module, values, patch] of cases) {
            const original = await f.save(kind, values, versions[module].id)
            const request = randomUUID()
            const corrected = await f.correct(
              kind,
              original.id,
              { ...values, ...patch },
              'Erro de digitação',
              request,
            )
            assert.equal(corrected.actor_id, f.patient)
            assert.equal(corrected.previous_record_id, original.id)
            assert.ok(corrected.created_at)
            assert.equal(
              (
                await f.correct(
                  kind,
                  original.id,
                  { ...values, ...patch },
                  'Erro de digitação',
                  request,
                )
              ).id,
              corrected.id,
            )
            const rows = await as(f.patient, () =>
              sql(`select * from public.${table}`),
            )
            assert.equal(rows.length, 2)
            const before = rows.find((row) => row.id === original.id),
              after = rows.find(
                (row) => row.id === corrected.replacement_record_id,
              )
            assert.equal(after.module_version_id, before.module_version_id)
            for (const [key, value] of Object.entries(patch))
              assert.equal(String(after[key]), String(value))
            await denied(
              () => f.correct(kind, original.id, { ...values, ...patch }),
              'PT409',
            )
            await denied(
              () =>
                f.correct(
                  kind,
                  original.id,
                  { ...values, ...patch },
                  'Motivo diferente',
                  request,
                ),
              'PT409',
            )
          }
          assert.equal(
            (
              await as(f.patient, () =>
                sql('select * from public.clinical_record_corrections'),
              )
            ).length,
            7,
          )
        },
      )
      await scenario(
        'a closed historical plan permits patient corrections but never replaces its dose or revives recording',
        async (f) => {
          await f.share()
          await f.grant()
          const old = await f.configure('glp1', {
            medication: 'Semaglutida',
            dose_mg: 1,
            interval_days: 7,
            anchor_date: '2020-01-01',
          })
          const original = await f.save(
            'injection',
            timed({ site: 'arm' }),
            old.id,
          )
          await f.configure(
            'glp1',
            {
              medication: 'Semaglutida',
              dose_mg: 2,
              interval_days: 7,
              anchor_date: '2020-01-01',
            },
            old.id,
          )
          await as(f.patient, () =>
            rpc('endo_revoke_clinical_activation', [f.doctor]),
          )
          const first = await f.correct(
            'injection',
            original.id,
            timed({ site: 'thigh' }),
          )
          const voided = await f.correct(
            'injection',
            first.replacement_record_id,
            null,
            'Aplicação anotada por engano',
          )
          assert.equal(voided.replacement_record_id, null)
          await denied(
            () =>
              f.correct(
                'injection',
                first.replacement_record_id,
                timed({ site: 'arm' }),
              ),
            'PT409',
          )
          const [snapshot] = await sql(
            'select v.dose_mg from public.injection_logs i join public.clinical_module_versions v on v.id=i.module_version_id where i.id=$1',
            [first.replacement_record_id],
          )
          assert.equal(Number(snapshot.dose_mg), 1)
          await denied(() =>
            f.save('injection', timed({ site: 'arm' }), old.id),
          )
          await db.query('delete from auth.users where id=$1', [f.patient])
          assert.equal(
            (await sql('select * from public.clinical_record_corrections'))
              .length,
            0,
          )
        },
      )
      await scenario(
        'only the patient can correct; unauthorized readers cannot see or alter audit rows',
        async (f) => {
          await f.share()
          await f.grant()
          const v = await f.configure(),
            original = await f.save(
              'glucose',
              timed({ value: 110, context: 'fasting' }),
              v.id,
            )
          for (const actor of [f.doctor, f.nutritionist, f.stranger])
            await denied(() =>
              f.correct(
                'glucose',
                original.id,
                timed({ value: 120, context: 'fasting' }),
                'Erro de digitação',
                randomUUID(),
                actor,
              ),
            )
          await f.correct(
            'glucose',
            original.id,
            timed({ value: 120, context: 'fasting' }),
          )
          assert.equal(
            (
              await as(f.doctor, () =>
                sql('select * from public.clinical_record_corrections'),
              )
            ).length,
            1,
          )
          assert.equal(
            (
              await as(f.stranger, () =>
                sql('select * from public.clinical_record_corrections'),
              )
            ).length,
            0,
          )
          for (const operation of [
            "update public.clinical_record_corrections set reason='Changed'",
            'delete from public.clinical_record_corrections',
          ])
            await denied(() => as(f.patient, () => sql(operation)))
          await as(f.patient, () =>
            rpc('endo_revoke_doctor_access', [f.doctor]),
          )
          assert.equal(
            (
              await as(f.doctor, () =>
                sql('select * from public.clinical_record_corrections'),
              )
            ).length,
            0,
          )
        },
      )
      await scenario(
        'invalid corrections roll back atomically and cannot inject actor, dose or future dates',
        async (f) => {
          await f.share()
          await f.grant()
          const v = await f.configure(),
            values = timed({ value: 110, context: 'fasting' }),
            original = await f.save('glucose', values, v.id)
          for (const [payload, reason] of [
            [values, '   '],
            [values, 'Motivo válido'],
            [{ ...values, value: 0 }, 'Motivo válido'],
            [
              { ...values, value: 120, module_version_id: randomUUID() },
              'Motivo válido',
            ],
            [
              { ...values, value: 120, occurred_at: '2099-01-01T10:00:00Z' },
              'Motivo válido',
            ],
          ])
            await denied(
              () => f.correct('glucose', original.id, payload, reason),
              null,
            )
          assert.equal(
            (await sql('select * from public.glucose_readings')).length,
            1,
          )
          assert.equal(
            (await sql('select * from public.clinical_record_corrections'))
              .length,
            0,
          )
        },
      )
      await scenario(
        'deleting a physician does not delete the patient history or medication snapshot',
        async (f) => {
          await f.share()
          await f.grant()
          const v = await f.configure('glp1', {
            medication: 'Semaglutida',
            dose_mg: 1,
            interval_days: 7,
            anchor_date: '2020-01-01',
          })
          await f.save('injection', timed({ site: 'arm' }), v.id)
          await db.query('delete from auth.users where id=$1', [f.doctor])
          assert.equal(
            (
              await as(f.patient, () =>
                sql('select * from public.injection_logs'),
              )
            ).length,
            1,
          )
          const [row] = await as(f.patient, () =>
            sql(
              'select dose_mg from public.clinical_module_versions where id=$1',
              [v.id],
            ),
          )
          assert.equal(Number(row.dose_mg), 1)
          assert.equal(
            (
              await as(f.patient, () =>
                rpc('endo_clinical_overview', [f.patient]),
              )
            ).modules[0].active,
            false,
          )
          await db.query('delete from auth.users where id=$1', [f.patient])
          assert.equal(
            (await sql('select * from public.injection_logs')).length,
            0,
          )
        },
      )
      await scenario(
        'repository payloads execute the same named RPC contract against PostgreSQL',
        async (f) => {
          await f.share()
          await f.grant()
          const v = await f.configure()
          let queue = Promise.resolve()
          const execute = (action) => {
            const next = queue.then(() => as(f.patient, action))
            queue = next.catch(() => {})
            return next
          }
          const client = {
            auth: {
              getUser: async () => ({
                data: { user: { id: f.patient } },
                error: null,
              }),
            },
            async rpc(name, args) {
              assert.match(name, /^endo_[a-z_]+$/)
              const keys = Object.keys(args)
              assert.ok(keys.every((key) => /^p_[a-z_]+$/.test(key)))
              const values = keys.map((key) => args[key])
              const named = keys
                .map((key, i) => `${key} => $${i + 1}`)
                .join(',')
              try {
                return {
                  data: (
                    await execute(() =>
                      sql(`select public.${name}(${named}) as result`, values),
                    )
                  )[0].result,
                  error: null,
                }
              } catch (error) {
                return { data: null, error }
              }
            },
            from(table) {
              assert.ok(tables.includes(table))
              const state = { orders: [], range: [0, 499] }
              const chain = {
                select() {
                  return chain
                },
                eq(key, value) {
                  assert.equal(key, 'patient_id')
                  state.patient = value
                  return chain
                },
                order(key, options) {
                  assert.ok(
                    ['id', 'occurred_at', 'occurred_on', 'created_at'].includes(
                      key,
                    ),
                  )
                  state.orders.push(
                    `${key} ${options.ascending ? 'asc' : 'desc'}`,
                  )
                  return chain
                },
                range(from, to) {
                  state.range = [from, to]
                  return chain
                },
                then(resolve, reject) {
                  return execute(() =>
                    sql(
                      `select * from public.${table} where patient_id=$1 order by ${state.orders.join(',')} limit $2 offset $3`,
                      [
                        state.patient,
                        state.range[1] - state.range[0] + 1,
                        state.range[0],
                      ],
                    ),
                  )
                    .then(
                      (data) => ({ data, error: null }),
                      (error) => ({ data: null, error }),
                    )
                    .then(resolve, reject)
                },
              }
              return chain
            },
          }
          const repository = createClinicalRepository(client, { enabled: true })
          const request = randomUUID()
          const record = {
            kind: 'glucose',
            values: {
              occurred_at: `${dateBefore(1)}T08:00`,
              value: '120',
              context: 'fasting',
            },
            module_version_id: v.id,
            request_id: request,
          }
          const saved = await repository.saveRecord(record)
          assert.equal((await repository.saveRecord(record)).id, saved.id)
          assert.equal((await repository.loadMine()).records[0].value, 120)
          await repository.revokeActivation(f.doctor)
          await denied(() =>
            f.save('glucose', timed({ value: 100, context: 'other' }), v.id),
          )
        },
      )
      for (const file of [
        'verify-patient-isolation.sql',
        'verify-doctor-sharing.sql',
        'verify-doctor-codes.sql',
        'verify-health-professionals.sql',
        'verify-phase1-height.sql',
      ]) {
        await t.test(`existing contract: ${file}`, async () => {
          const results = await db.exec(
            await readFile(new URL('supabase/' + file, root), 'utf8'),
          )
          assert.match(results.at(-1).rows[0].result, /passed$/)
        })
      }
    } finally {
      await db.close()
    }
  },
)
