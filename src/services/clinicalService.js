import { clinicalIntegrationEnabled } from '../config/clinicalPreview'
import { supabase } from '../lib/supabaseClient'
import { createClinicalRepository } from './clinicalRepository'

export const clinicalRepository = createClinicalRepository(supabase, {
  enabled: clinicalIntegrationEnabled,
})
