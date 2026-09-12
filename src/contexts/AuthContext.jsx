import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  getCurrentSession,
  onAuthStateChange,
  signInWithEmail,
  signInWithGoogle,
  signOut as signOutService,
  signUpWithEmail,
} from '../services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadSession() {
      const { session: currentSession } = await getCurrentSession()

      if (isMounted) {
        setSession(currentSession)
        setIsLoading(false)
      }
    }

    loadSession()

    const subscription = onAuthStateChange((nextSession) => {
      setSession(nextSession)
      setIsLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(email, password) {
    const result = await signInWithEmail(email, password)

    if (!result.error) {
      setSession(result.data.session ?? { user: result.data.user })
    }

    return result
  }

  async function signUp(email, password, fullName) {
    const result = await signUpWithEmail(email, password, fullName)

    if (result.error) {
      return result
    }

    if (result.mode === 'demo') {
      setSession({ user: result.data.user })
      return result
    }

    if (result.data.session) {
      setSession(result.data.session)
      return result
    }

    return { ...result, needsEmailConfirmation: true }
  }

  async function signInGoogle() {
    const result = await signInWithGoogle()

    if (!result.error && result.mode === 'demo') {
      setSession({ user: result.data.user })
    }

    return result
  }

  async function signOut() {
    const result = await signOutService()

    if (!result.error) {
      setSession(null)
    }

    return result
  }

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(session?.user),
      isLoading,
      session,
      user: session?.user ?? null,
      signIn,
      signInGoogle,
      signOut,
      signUp,
    }),
    [isLoading, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}
