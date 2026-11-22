import { readReminderHomologationEnabled } from '../lib/reminderFeature.js'

export const remindersHomologationEnabled = readReminderHomologationEnabled(
  import.meta.env ?? {},
)
