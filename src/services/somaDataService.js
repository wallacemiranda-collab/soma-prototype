import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { areas, todayHabits, user, weeklyProgress } from '../data/mockData'

export async function getCurrentProfile() {
  if (!isSupabaseConfigured) {
    return {
      data: user,
      error: null,
      mode: 'demo',
    }
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getUser()

  if (sessionError) {
    return { data: null, error: sessionError, mode: 'supabase' }
  }

  const userId = sessionData.user?.id

  if (!userId) {
    return { data: null, error: null, mode: 'supabase' }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  return { data, error, mode: 'supabase' }
}

export async function getMetabolicSummary() {
  if (!isSupabaseConfigured) {
    return {
      data: {
        areas,
        todayHabits,
        weeklyProgress,
      },
      error: null,
      mode: 'demo',
    }
  }

  const { data, error } = await supabase
    .from('metabolic_entries')
    .select('*')
    .order('entry_date', { ascending: false })
    .limit(30)

  return { data, error, mode: 'supabase' }
}
