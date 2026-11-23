import { homologationProject } from '../config/homologation.js'
import { readBackendConfig } from './backendConfig.js'
import { isValidVapidPublicKey } from './webPush.js'

export function readReminderHomologationEnabled(env = {}) {
  const backend = readBackendConfig(env)
  return (
    env.VITE_REMINDERS_HOMOLOGATION_ENABLED === 'true' &&
    env.VITE_HOMOLOGATION_ENABLED === 'true' &&
    env.VITE_PHASE3_PREVIEW_ENABLED !== 'true' &&
    isValidVapidPublicKey(env.VITE_REMINDER_VAPID_PUBLIC_KEY) &&
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
