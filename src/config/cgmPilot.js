import { homologationProject } from './homologation.js'
import { phase3Preview } from './phase3Preview.js'

const env = import.meta.env ?? {}

export const cgmPilotEnabled =
  env.VITE_CGM_PILOT_ENABLED === 'true' &&
  env.VITE_HOMOLOGATION_ENABLED === 'true' &&
  env.VITE_SUPABASE_URL === `https://${homologationProject}.supabase.co` &&
  !phase3Preview.requested
