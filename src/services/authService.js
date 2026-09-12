import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'

const DEMO_SESSION_KEY = 'soma_demo_session'

function createDemoUser(email, fullName = 'Marina Alves') {
  return {
    id: 'demo-user',
    email,
    user_metadata: {
      full_name: fullName,
    },
  }
}

function saveDemoSession(user) {
  localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify({ user }))
}

function readDemoSession() {
  const storedSession = localStorage.getItem(DEMO_SESSION_KEY)

  if (!storedSession) {
    return null
  }

  try {
    return JSON.parse(storedSession)
  } catch {
    localStorage.removeItem(DEMO_SESSION_KEY)
    return null
  }
}

function clearDemoSession() {
  localStorage.removeItem(DEMO_SESSION_KEY)
}

function getAuthRedirectUrl() {
  return `${window.location.origin}/home`
}

export async function signInWithEmail(email, password) {
  if (!isSupabaseConfigured) {
    const user = createDemoUser(email)
    saveDemoSession(user)

    return {
      data: {
        user,
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
    const user = createDemoUser(email, fullName)
    saveDemoSession(user)

    return {
      data: {
        user,
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

export async function signInWithGoogle() {
  if (!isSupabaseConfigured) {
    const user = createDemoUser('google.demo@soma.app', 'Usuário Google')
    saveDemoSession(user)

    return {
      data: {
        user,
      },
      error: null,
      mode: 'demo',
    }
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getAuthRedirectUrl(),
    },
  })

  return { data, error, mode: 'supabase', redirecting: !error }
}

export async function signOut() {
  if (!isSupabaseConfigured) {
    clearDemoSession()
    return { error: null, mode: 'demo' }
  }

  const { error } = await supabase.auth.signOut()
  return { error, mode: 'supabase' }
}

export async function getCurrentSession() {
  if (!isSupabaseConfigured) {
    return { session: readDemoSession(), mode: 'demo' }
  }

  const { data, error } = await supabase.auth.getSession()
  return { session: data?.session ?? null, error, mode: 'supabase' }
}

export function onAuthStateChange(callback) {
  if (!isSupabaseConfigured) {
    return {
      unsubscribe() {},
    }
  }

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })

  return data.subscription
}
