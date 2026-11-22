import { isGoogleAuthEnabled, supabase } from '../lib/supabaseClient.js'
import {
  homologationEnabled,
  isSyntheticLogin,
} from '../config/homologation.js'

function unavailable() {
  return {
    data: null,
    error: new Error('O acesso às contas está temporariamente indisponível.'),
  }
}

export async function signInWithEmail(email, password) {
  if (!supabase) return unavailable()
  if (homologationEnabled && !isSyntheticLogin(email)) return unavailable()
  return supabase.auth.signInWithPassword({ email: email.trim(), password })
}

export async function signUpWithEmail(email, password, fullName) {
  if (!supabase || homologationEnabled) return unavailable()
  return supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      data: { full_name: fullName.trim() },
    },
  })
}

export async function signInWithGoogle() {
  if (!isGoogleAuthEnabled) return unavailable()
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  })
}

export async function signOut() {
  if (!supabase) return { error: null }
  return supabase.auth.signOut()
}

export async function requestPasswordReset(email) {
  if (!supabase || homologationEnabled) return unavailable()
  return supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/redefinir-senha`,
  })
}

export async function updatePassword(password) {
  if (!supabase || homologationEnabled) return unavailable()
  return supabase.auth.updateUser({ password })
}

export async function getCurrentSession() {
  if (!supabase) return { session: null, error: null }
  const { data, error } = await supabase.auth.getSession()
  return { session: data?.session ?? null, error }
}

export function onAuthStateChange(callback) {
  if (!supabase) return { unsubscribe() {} }
  return supabase.auth.onAuthStateChange((event, session) =>
    callback(session, event),
  ).data.subscription
}
