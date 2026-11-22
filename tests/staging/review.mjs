import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { loadStagingConfig, confirmStagingBackend } from './support.mjs'
import { createClinicalRepository } from '../../src/services/clinicalRepository.js'
import { createSharingRepository } from '../../src/services/sharingRepository.js'
import { createPatientRepository } from '../../src/services/patientRepository.js'
import { exampleRecords } from '../../src/lib/clinicalModules.js'
import { dateBefore } from '../../src/lib/patientData.js'

const config = loadStagingConfig()
const actors = {}
try {
  for (const account of config.accounts) {
    const client = createClient(config.url, config.publishable_key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: `review-${config.run}-${account.role}`,
      },
    })
    await confirmStagingBackend(client)
    const { data, error } = await client.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    })
    if (error || data.user.id !== account.id)
      throw new Error('Synthetic login failed.')
    actors[account.role] = {
      ...account,
      client,
      clinical: createClinicalRepository(client, { enabled: true }),
      sharing: createSharingRepository(client),
      patient: createPatientRepository(client),
    }
  }
  const { patient, doctor, otherDoctor, nutritionist } = actors
  if ((await patient.clinical.loadMine()).modules.length)
    throw new Error('Refuse to overwrite an existing review.')
  for (const [actor, name, profession, council, crm] of [
    [doctor, 'Médico fictício A', 'Medicina', 'CRM', '12345'],
    [otherDoctor, 'Médico fictício B', 'Medicina', 'CRM', '54321'],
    [nutritionist, 'Nutricionista fictícia', 'Nutrição', 'CRN', '98765'],
  ])
    await actor.sharing.registerDoctor({
      professional_name: name,
      profession,
      council,
      crm,
      crm_state: 'SP',
      confirmed: true,
    })
  await patient.patient.saveProfile({
    full_name: 'Paciente fictício de revisão',
    height_cm: 170,
    goal_weight: 88,
    weekly_exercise_goal: 150,
    sleep_goal_hours: 7,
  })
  for (const [days, weight, waist] of [
    [21, 94.2, 107],
    [14, 93.5, 106],
    [7, 93, 105],
    [0, 92.4, 104],
  ])
    await patient.patient.saveEntry({
      entry_date: dateBefore(days),
      weight_kg: weight,
      waist_cm: waist,
      sleep_minutes: 432,
      activity_minutes: 30,
      water_liters: 1.9,
      mood_score: 8,
      height_reference_cm: days === 0 ? 170 : null,
    })
  for (const actor of [doctor, otherDoctor, nutritionist])
    await patient.sharing.grant({
      doctor_id: actor.id,
      days: 30,
      confirmed: true,
    })
  await patient.clinical.grantActivation({
    doctor_id: doctor.id,
    request_id: randomUUID(),
    confirmed: true,
  })
  const plans = {
    diabetes: { low: 80, high: 180 },
    glp1: {
      medication: 'Semaglutida',
      dose_mg: 1,
      interval_days: 7,
      anchor_date: dateBefore(14),
    },
    thyroid: {},
    pressure: {},
  }
  for (const [module_key, details] of Object.entries(plans)) {
    const version = await doctor.clinical.configure({
      patient_id: patient.id,
      module_key,
      expected_version: null,
      request_id: randomUUID(),
      config: details,
    })
    for (const { kind, ...values } of exampleRecords(module_key))
      await patient.clinical.saveRecord({
        kind,
        values,
        module_version_id: version.id,
        request_id: randomUUID(),
      })
  }
  const loaded = await patient.clinical.loadMine()
  if (
    loaded.modules.filter((row) => row.active).length !== 4 ||
    new Set(loaded.records.map((row) => row.kind)).size !== 7
  )
    throw new Error('Incomplete review fixtures.')
  console.log(
    JSON.stringify({
      prepared: true,
      syntheticOnly: true,
      modules: 4,
      recordTypes: 7,
      records: loaded.records.length,
    }),
  )
} finally {
  for (const actor of Object.values(actors))
    await actor.client.auth.signOut().catch(() => {})
}
