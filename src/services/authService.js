import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'

export async function signInWithEmail(email, password) {
  if (!isSupabaseConfigured) {
    return {
      data: {
        user: {
          email,
        },
      },
      error: null,
      mode: 'demo',
    }
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  return { data, error, mode: 'supabase' }
}

export async function signUpWithEmail(email, password, fullName) {
  if (!isSupabaseConfigured) {
    return {
      data: {
        user: {
          email,
          user_metadata: {
            full_name: fullName,
          },
        },
      },
      error: null,
      mode: 'demo',
    }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  })

  return { data, error, mode: 'supabase' }
}

export async function signOut() {
  if (!isSupabaseConfigured) {
    return { error: null, mode: 'demo' }
  }

  const { error } = await supabase.auth.signOut()
  return { error, mode: 'supabase' }
}
