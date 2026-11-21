import { supabase } from '../lib/supabaseClient'
import { createSharingRepository } from './sharingRepository'

export const sharingRepository = createSharingRepository(supabase)
