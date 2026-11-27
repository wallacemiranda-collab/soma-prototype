import { cgmPilotEnabled } from '../config/cgmPilot.js'
import { supabase } from '../lib/supabaseClient.js'
import { createCgmPilotRepository } from './cgmPilotRepository.js'

export const cgmPilotRepository = createCgmPilotRepository(supabase, {
  enabled: cgmPilotEnabled,
})
