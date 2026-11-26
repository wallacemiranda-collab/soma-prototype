import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const stagingProject = 'ctcsolobseerqnddahun'
export const productionProject = 'trlwhngxqfgksiponpzk'
export const stagingTables = [
  'patient_reminder_preferences',
  'patient_reminder_rules',
  'glucose_readings',
  'hypoglycemia_events',
  'hba1c_results',
  'injection_logs',
  'gi_symptom_logs',
  'thyroid_intakes',
  'blood_pressure_readings',
]

export function validateStagingConfig(value) {
  if (
    value?.mode !== 'homologation' ||
    value.project_id !== stagingProject ||
    value.project_id === productionProject ||
    value.url !== `https://${stagingProject}.supabase.co` ||
    !value.publishable_key?.startsWith('sb_publishable_')
  )
    throw new Error('Staging guard: refuse an unknown or production backend.')
  if (!Array.isArray(value.accounts) || value.accounts.length !== 5)
    throw new Error('Exactly five synthetic accounts are required.')
  if (!/^[0-9a-f]{16}$/.test(value.run))
    throw new Error('Invalid synthetic test run.')
  const roles = [
    'patient',
    'otherPatient',
    'doctor',
    'otherDoctor',
    'nutritionist',
  ]
  for (const account of value.accounts) {
    if (
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(account.id) ||
      !roles.includes(account.role) ||
      account.email !==
        `endo-${value.run}-${account.role.toLowerCase()}@example.invalid` ||
      !/^[A-Za-z0-9_-]{24,80}$/.test(account.password)
    )
      throw new Error('Only generated synthetic credentials are accepted.')
  }
  if (
    new Set(value.accounts.map((account) => account.id)).size !== 5 ||
    new Set(value.accounts.map((account) => account.email)).size !== 5 ||
    new Set(value.accounts.map((account) => account.role)).size !== 5
  )
    throw new Error('Duplicate staging identities.')
  return value
}
export function loadStagingConfig(
  path = process.env.ENDO_STAGING_CONFIG || resolve('.endo-homologation.local'),
) {
  return validateStagingConfig(JSON.parse(readFileSync(path, 'utf8')))
}
export async function confirmStagingBackend(client) {
  const { data, error } = await client.rpc('endo_homologation_info')
  if (
    error ||
    data?.environment !== 'homologation' ||
    data?.project_id !== stagingProject ||
    data?.synthetic_only !== true
  )
    throw new Error(
      'Staging guard: the backend did not confirm a synthetic-only environment.',
    )
}
