import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createClinicalRepository } from '../../src/services/clinicalRepository.js'
import { createSharingRepository } from '../../src/services/sharingRepository.js'
import { dateBefore } from '../../src/lib/patientData.js'
import { clinicalRecordTypes } from '../../src/lib/clinicalModules.js'
import {
  loadStagingConfig,
  confirmStagingBackend,
  stagingTables,
} from './support.mjs'

test(
  'hosted homologation: Auth, Data API and concurrent clinical writes',
  { timeout: 240000 },
  async (t) => {
    const config = loadStagingConfig()
    const anonymous = createClient(config.url, config.publishable_key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
    await confirmStagingBackend(anonymous)
    const actors = {}
    const request = (url, options) =>
      fetch(url, { ...options, signal: AbortSignal.timeout(20000) })
    // Concurrency checks bypass the SDK session lifecycle, but use real Auth-issued tokens.
    const rpc = async (actor, name, args) => {
      const response = await request(`${config.url}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: {
          apikey: config.publishable_key,
          Authorization: `Bearer ${actor.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...args, p_actor_id: actor.id }),
      })
      const raw = await response.text()
      const body = raw ? JSON.parse(raw) : null
      if (!response.ok)
        throw Object.assign(
          new Error(body.message || 'Staging request failed'),
          { code: body.code, status: response.status },
        )
      return body
    }
    const value = async (promise) => {
      const result = await promise
      if (result.error)
        throw new Error(
          `Unexpected API failure: ${result.error.code || ''} ${result.error.message || ''}`,
        )
      return result.data
    }
    const denied = async (action) => {
      let failure
      try {
        await action()
      } catch (error) {
        failure = error
      }
      assert.ok(failure, 'The server must reject the unauthorized operation')
    }
    const rawDenied = async (promise) =>
      assert.ok((await promise).error, 'The API must reject direct access')
    try {
      for (const account of config.accounts) {
        const client = createClient(config.url, config.publishable_key, {
          global: { fetch: request },
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
            storageKey: `endo-stage-${config.run}-${account.role}`,
          },
        })
        const result = await client.auth.signInWithPassword({
          email: account.email,
          password: account.password,
        })
        assert.ok(
          !result.error,
          `Synthetic login failed: ${result.error?.message || ''}`,
        )
        assert.equal(result.data.user.id, account.id)
        actors[account.role] = {
          ...account,
          token: result.data.session.access_token,
          client,
          clinical: createClinicalRepository(client, { enabled: true }),
          sharing: createSharingRepository(client),
        }
      }
      const { patient, otherPatient, doctor, otherDoctor, nutritionist } =
        actors
      const when = `${dateBefore(1)}T08:00`
      const record = (kind, values, version, request_id = randomUUID()) =>
        patient.clinical.saveRecord({
          kind,
          values,
          module_version_id: version.id,
          request_id,
        })
      const configure = (
        module_key,
        details,
        expected_version = null,
        actor = doctor,
      ) =>
        actor.clinical.configure({
          patient_id: patient.id,
          module_key,
          config: details,
          expected_version,
          request_id: randomUUID(),
        })
      const grantRead = (actor) =>
        patient.sharing.grant({
          doctor_id: actor.id,
          days: 30,
          confirmed: true,
        })
      const grantActivation = (actor) =>
        patient.clinical.grantActivation({
          doctor_id: actor.id,
          confirmed: true,
          request_id: randomUUID(),
        })
      let diabetes, glp1, pressure

      await t.test(
        'real password login and automatic profiles use only the five synthetic accounts',
        async () => {
          for (const actor of Object.values(actors)) {
            const profile = await value(
              actor.client
                .from('profiles')
                .select('id,email')
                .eq('id', actor.id)
                .single(),
            )
            assert.equal(profile.id, actor.id)
            assert.ok(profile.email.endsWith('@example.invalid'))
          }
          await doctor.sharing.registerDoctor({
            professional_name: 'Médico fictício de homologação A',
            profession: 'Medicina',
            council: 'CRM',
            crm: '12345',
            crm_state: 'SP',
            confirmed: true,
          })
          await otherDoctor.sharing.registerDoctor({
            professional_name: 'Médico fictício de homologação B',
            profession: 'Medicina',
            council: 'CRM',
            crm: '54321',
            crm_state: 'SP',
            confirmed: true,
          })
          await nutritionist.sharing.registerDoctor({
            professional_name: 'Nutricionista fictícia de homologação',
            profession: 'Nutrição',
            council: 'CRN',
            crm: '98765',
            crm_state: 'SP',
            confirmed: true,
          })
        },
      )
      await t.test(
        'anonymous and private-schema access are denied by the actual Data API',
        async () => {
          for (const table of stagingTables)
            await rawDenied(anonymous.from(table).select('id').limit(1))
          await rawDenied(
            patient.client
              .schema('endo_private')
              .from('doctor_code_reservations')
              .select('*'),
          )
          await rawDenied(
            otherPatient.client.rpc('endo_clinical_overview', {
              p_patient_id: patient.id,
            }),
          )
        },
      )
      await t.test(
        'read authorization does not silently become module activation consent',
        async () => {
          await grantRead(doctor)
          await denied(() => configure('diabetes', { low: 80, high: 180 }))
          await grantActivation(doctor)
          diabetes = await configure('diabetes', { low: 80, high: 180 })
          glp1 = await configure('glp1', {
            medication: 'Semaglutida',
            dose_mg: 1,
            interval_days: 7,
            anchor_date: '2020-01-01',
          })
          pressure = await configure('pressure', {})
          assert.equal(
            (await patient.clinical.loadMine()).modules.filter(
              (module) => module.active,
            ).length,
            3,
          )
        },
      )
      await t.test(
        'all seven clinical record types round-trip through authenticated RPCs',
        async () => {
          const thyroid = await configure('thyroid', {})
          for (const [kind, values, version] of [
            [
              'glucose',
              { occurred_at: when, value: 110, context: 'fasting' },
              diabetes,
            ],
            [
              'hypoglycemia',
              {
                occurred_at: when,
                value: '',
                symptoms: 'Sintoma fictício',
                action_taken: 'Ação fictícia de teste',
              },
              diabetes,
            ],
            ['hba1c', { occurred_on: dateBefore(1), value: 6.8 }, diabetes],
            ['injection', { occurred_at: when, site: 'abdomen' }, glp1],
            [
              'gi',
              {
                occurred_at: when,
                nausea: '1',
                vomiting: '0',
                constipation: '0',
                diarrhea: '0',
                reflux: '2',
              },
              glp1,
            ],
            ['thyroid', { occurred_at: when, fasting: 'unsure' }, thyroid],
            [
              'pressure',
              { occurred_at: when, systolic: 120, diastolic: 80, pulse: 72 },
              pressure,
            ],
          ]) {
            const saved = await record(kind, values, version)
            assert.equal(saved.patient_id, patient.id)
            assert.equal(saved.module_version_id, version.id)
          }
          const loaded = await patient.clinical.loadMine()
          assert.equal(new Set(loaded.records.map((row) => row.kind)).size, 7)
          assert.ok(
            loaded.records.every(
              (row) => row.time_zone && row.patient_id === patient.id,
            ),
          )
          await denied(() => otherPatient.clinical.loadPatient(patient.id))
          assert.equal(
            (
              await value(
                otherPatient.client.from('glucose_readings').select('*'),
              )
            ).length,
            0,
          )
        },
      )
      await t.test(
        'parallel retries of one request create one record, not duplicates',
        async () => {
          const request = randomUUID()
          const payload = {
            occurred_at: new Date(when).toISOString(),
            time_zone: 'America/Sao_Paulo',
            value: 123,
            context: 'other',
          }
          const args = {
            p_kind: 'glucose',
            p_values: payload,
            p_module_version: diabetes.id,
            p_request_id: request,
          }
          const results = await Promise.all([
            rpc(patient, 'endo_save_clinical_record', args),
            rpc(patient, 'endo_save_clinical_record', args),
          ])
          assert.equal(results[0].id, results[1].id)
          const rows = await value(
            patient.client
              .from('glucose_readings')
              .select('id')
              .eq('patient_id', patient.id)
              .eq('request_id', request),
          )
          assert.equal(rows.length, 1)
          await assert.rejects(
            rpc(patient, 'endo_save_clinical_record', {
              ...args,
              p_values: { ...payload, value: 124 },
            }),
            { code: 'PT409' },
          )
        },
      )
      await t.test(
        'competing plan updates have one winner and preserve the older dose',
        async () => {
          const old = glp1
          const results = await Promise.allSettled(
            [2, 3].map((dose_mg) =>
              rpc(doctor, 'endo_configure_clinical_module', {
                p_patient_id: patient.id,
                p_module_key: 'glp1',
                p_expected_version: old.id,
                p_request_id: randomUUID(),
                p_config: {
                  medication: 'Semaglutida',
                  dose_mg,
                  interval_days: 7,
                  anchor_date: '2020-01-01',
                },
              }),
            ),
          )
          assert.equal(
            results.filter((result) => result.status === 'fulfilled').length,
            1,
          )
          assert.equal(
            results.filter((result) => result.status === 'rejected').length,
            1,
          )
          assert.equal(
            results.find((result) => result.status === 'rejected').reason.code,
            'PT409',
          )
          glp1 = results.find((result) => result.status === 'fulfilled').value
          const loaded = await patient.clinical.loadMine()
          const injection = loaded.records.find(
            (row) => row.kind === 'injection',
          )
          assert.equal(
            loaded.versions.find((v) => v.id === injection.module_version_id)
              .dose_mg,
            1,
          )
          await denied(() =>
            record('injection', { occurred_at: when, site: 'thigh' }, old),
          )
        },
      )
      await t.test(
        'a second physician cannot replace a responsible physician without patient closure',
        async () => {
          await grantRead(otherDoctor)
          await grantActivation(otherDoctor)
          await denied(() =>
            configure('pressure', {}, pressure.id, otherDoctor),
          )
          await patient.clinical.closeModule({
            module_key: 'pressure',
            expected_version: pressure.id,
          })
          pressure = await configure('pressure', {}, pressure.id, otherDoctor)
          assert.equal(pressure.doctor_id, otherDoctor.id)
        },
      )
      await t.test(
        'unauthorized professions, forged actors and metadata cannot configure modules',
        async () => {
          await grantRead(nutritionist)
          assert.ok(
            (await nutritionist.clinical.loadPatient(patient.id)).records
              .length > 0,
          )
          await denied(() => grantActivation(nutritionist))
          await denied(() =>
            configure(
              'diabetes',
              { low: 90, high: 180 },
              diabetes.id,
              nutritionist,
            ),
          )
          await rawDenied(
            nutritionist.client
              .from('glucose_readings')
              .update({ value: 999 })
              .eq('patient_id', patient.id),
          )
          await rawDenied(
            otherDoctor.client.rpc('endo_configure_clinical_module', {
              p_actor_id: doctor.id,
              p_patient_id: patient.id,
              p_module_key: 'diabetes',
              p_expected_version: diabetes.id,
              p_request_id: randomUUID(),
              p_config: {},
            }),
          )
          await value(
            otherPatient.client.auth.updateUser({
              data: { role: 'doctor', verified: true },
            }),
          )
          await denied(() =>
            configure('diabetes', {}, diabetes.id, otherPatient),
          )
        },
      )
      await t.test(
        'revocation racing a configuration leaves the module inactive and blocks new records',
        async () => {
          const results = await Promise.allSettled([
            rpc(patient, 'endo_revoke_clinical_activation', {
              p_doctor_id: doctor.id,
            }),
            rpc(doctor, 'endo_configure_clinical_module', {
              p_patient_id: patient.id,
              p_module_key: 'diabetes',
              p_expected_version: diabetes.id,
              p_request_id: randomUUID(),
              p_config: { low: 90, high: 180 },
            }),
          ])
          assert.equal(results[0].status, 'fulfilled')
          if (results[1].status === 'rejected')
            assert.equal(results[1].reason.code, '42501')
          const loaded = await patient.clinical.loadMine()
          const module = loaded.modules.find(
            (value) => value.module_key === 'diabetes',
          )
          assert.equal(module.active, false)
          assert.ok(loaded.records.length >= 7)
          await denied(() =>
            record(
              'glucose',
              { occurred_at: when, value: 120, context: 'other' },
              { id: module.current_version_id },
            ),
          )
          await grantActivation(doctor)
          assert.equal(
            (await patient.clinical.loadMine()).modules.find(
              (value) => value.module_key === 'diabetes',
            ).active,
            false,
          )
        },
      )
      await t.test(
        'revoking read access also removes clinical visibility without affecting another physician',
        async () => {
          await patient.sharing.revoke(doctor.id)
          await denied(() => doctor.clinical.loadPatient(patient.id))
          assert.equal(
            (
              await value(
                doctor.client
                  .from('glucose_readings')
                  .select('*')
                  .eq('patient_id', patient.id),
              )
            ).length,
            0,
          )
          assert.ok(
            (await otherDoctor.clinical.loadPatient(patient.id)).records
              .length > 0,
          )
          await grantRead(doctor)
          assert.equal(
            (await patient.clinical.loadMine()).modules.find(
              (value) => value.module_key === 'diabetes',
            ).active,
            false,
          )
        },
      )
      await t.test(
        'all seven correction kinds preserve originals, historical plans and patient-only audit ownership',
        async () => {
          const before = await patient.clinical.loadMine()
          const patches = {
            glucose: { value: 111 },
            hypoglycemia: { value: 60 },
            hba1c: { value: 6.9 },
            injection: { site: 'thigh' },
            gi: { nausea: 2 },
            thyroid: { fasting: 'no' },
            pressure: { systolic: 125 },
          }
          for (const [kind, patch] of Object.entries(patches)) {
            const original = before.records.find(
              (row) =>
                row.kind === kind && (kind !== 'glucose' || row.value === 110),
            )
            const values = Object.fromEntries(
              clinicalRecordTypes[kind].fields.map((field) => [
                field.key,
                original[field.key] ?? null,
              ]),
            )
            Object.assign(values, patch, { time_zone: original.time_zone })
            const args = {
              p_kind: kind,
              p_record_id: original.id,
              p_request_id: randomUUID(),
              p_reason: 'Correção fictícia de digitação',
              p_values: values,
            }
            const results = await Promise.all([
              rpc(patient, 'endo_correct_clinical_record', args),
              rpc(patient, 'endo_correct_clinical_record', args),
            ])
            assert.equal(results[0].id, results[1].id)
            assert.equal(results[0].actor_id, patient.id)
            const loaded = await patient.clinical.loadMine()
            const replacement = loaded.records.find(
              (row) => row.id === results[0].replacement_record_id,
            )
            assert.equal(
              replacement.module_version_id,
              original.module_version_id,
            )
            assert.equal(replacement.audit[0].before.id, original.id)
            for (const actor of [
              doctor,
              otherDoctor,
              nutritionist,
              otherPatient,
            ])
              await assert.rejects(
                rpc(actor, 'endo_correct_clinical_record', {
                  ...args,
                  p_request_id: randomUUID(),
                }),
                { code: '42501' },
              )
          }
          assert.equal(
            (await patient.clinical.loadMine()).corrections.length,
            7,
          )
          assert.equal(
            (await otherDoctor.clinical.loadPatient(patient.id)).corrections
              .length,
            7,
          )
          await rawDenied(
            patient.client
              .from('clinical_record_corrections')
              .update({ reason: 'Forged' })
              .eq('patient_id', patient.id),
          )
          await rawDenied(
            otherDoctor.client.rpc('endo_correct_clinical_record', {
              p_actor_id: patient.id,
              p_kind: 'glucose',
              p_record_id: before.records[0].id,
              p_request_id: randomUUID(),
              p_reason: 'Forged actor',
              p_values: null,
            }),
          )
        },
      )
      await t.test(
        'competing corrections have one winner, voids retain the chain and revoked readers lose its reasons',
        async () => {
          const current = (await patient.clinical.loadMine()).records.find(
            (row) => row.kind === 'glucose' && row.value === 111,
          )
          const results = await Promise.allSettled(
            [112, 113].map((value) =>
              rpc(patient, 'endo_correct_clinical_record', {
                p_kind: 'glucose',
                p_record_id: current.id,
                p_request_id: randomUUID(),
                p_reason: 'Correção concorrente fictícia',
                p_values: {
                  occurred_at: current.occurred_at,
                  time_zone: current.time_zone,
                  context: current.context,
                  value,
                },
              }),
            ),
          )
          assert.equal(
            results.filter((row) => row.status === 'fulfilled').length,
            1,
          )
          const failure = results.find(
            (row) => row.status === 'rejected',
          ).reason
          assert.equal(failure.code, 'PT409')
          assert.equal(failure.status, 409)
          const head = results.find((row) => row.status === 'fulfilled').value
            .replacement_record_id
          await patient.clinical.voidRecord({
            kind: 'glucose',
            record_id: head,
            request_id: randomUUID(),
            reason: 'Registro fictício duplicado',
            confirmed: true,
          })
          const loaded = await patient.clinical.loadMine()
          assert.ok(!loaded.records.some((row) => row.id === head))
          const history = loaded.historyRecords.find((row) => row.id === head)
          assert.equal(history.voided, true)
          assert.equal(history.audit.length, 3)
          await patient.sharing.revoke(nutritionist.id)
          assert.equal(
            (
              await value(
                nutritionist.client
                  .from('clinical_record_corrections')
                  .select('*'),
              )
            ).length,
            0,
          )
          await denied(() => nutritionist.clinical.loadPatient(patient.id))
        },
      )
      // A separate synthetic patient is reserved for the browser smoke test.
      await otherPatient.sharing.grant({
        doctor_id: otherDoctor.id,
        days: 30,
        confirmed: true,
      })
      await otherPatient.clinical.grantActivation({
        doctor_id: otherDoctor.id,
        confirmed: true,
        request_id: randomUUID(),
      })
      await otherDoctor.clinical.configure({
        patient_id: otherPatient.id,
        module_key: 'diabetes',
        expected_version: null,
        request_id: randomUUID(),
        config: { low: 80, high: 180 },
      })
      t.diagnostic(
        'Synthetic-only Auth/Data API checks complete; no emails or production data used.',
      )
    } finally {
      for (const actor of Object.values(actors))
        await actor.client.auth.signOut().catch(() => {})
    }
  },
)
