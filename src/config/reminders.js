import { readReminderHomologationEnabled } from '../lib/reminderFeature.js'

export const remindersHomologationEnabled = readReminderHomologationEnabled(
  import.meta.env ?? {},
)
export const reminderPushPublicKey = (import.meta.env ?? {})
  .VITE_REMINDER_VAPID_PUBLIC_KEY ?? ''
