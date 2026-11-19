import { createClient } from '@supabase/supabase-js'
import { readBackendConfig } from './backendConfig.js'

const env = import.meta.env ?? {}
const { url, key, configured } = readBackendConfig(env)

export const isSupabaseConfigured = configured
export const isGoogleAuthEnabled =
  isSupabaseConfigured && env.VITE_GOOGLE_AUTH_ENABLED === 'true'

export const supabase = isSupabaseConfigured ? createClient(url, key) : null
