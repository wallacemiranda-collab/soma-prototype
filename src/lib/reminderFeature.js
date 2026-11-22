import { homologationProject } from '../config/homologation.js'
import { readBackendConfig } from './backendConfig.js'

export function readReminderHomologationEnabled(env = {}) {
  const backend = readBackendConfig(env)
  return (
    env.VITE_REMINDERS_HOMOLOGATION_ENABLED === 'true' &&
    env.VITE_HOMOLOGATION_ENABLED === 'true' &&
    env.VITE_PHASE3_PREVIEW_ENABLED !== 'true' &&
    backend.configured &&
    backend.url === `https://${homologationProject}.supabase.co`
  )
}

export function isSyntheticPatient(email) {
  return (
    typeof email === 'string' &&
    /^endo-[0-9a-f]{16}-(patient|otherpatient)@example\.invalid$/i.test(
      email.trim(),
    )
  )
}
