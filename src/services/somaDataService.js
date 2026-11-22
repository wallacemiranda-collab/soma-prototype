import { supabase } from '../lib/supabaseClient.js'
import { remindersHomologationEnabled } from '../config/reminders.js'
import { createPatientRepository } from './patientRepository.js'
import { createReminderRepository } from './reminderRepository.js'

export const patientRepository = createPatientRepository(supabase)
export const reminderRepository = createReminderRepository(supabase, {
  enabled: remindersHomologationEnabled,
})
