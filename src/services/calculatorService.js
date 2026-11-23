import { supabase } from '../lib/supabaseClient.js'
import { calculatorsEnabled } from '../config/calculators.js'
import { createCalculatorRepository } from './calculatorRepository.js'

export const calculatorRepository = createCalculatorRepository(supabase, {
  enabled: calculatorsEnabled,
})
