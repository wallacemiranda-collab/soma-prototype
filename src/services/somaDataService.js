import { supabase } from '../lib/supabaseClient.js'
import { createPatientRepository } from './patientRepository.js'

export const patientRepository = createPatientRepository(supabase)
