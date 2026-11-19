import { createContext, useContext, useEffect, useState } from 'react'
import {
  getCurrentSession,
  onAuthStateChange,
  signInWithEmail,
  signInWithGoogle,
  signOut as endSession,
  signUpWithEmail,
} from '../services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)

  useEffect(() => {
    let active = true
    let eventReceived = false
    const subscription = onAuthStateChange((nextSession) => {
      eventReceived = true
      if (active) {
        setSession(nextSession)
        setIsDemo(false)
        setIsLoading(false)
      }
    })
    getCurrentSession()
      .then(({ session: current }) => {
        if (active && !eventReceived) setSession(current)
      })
      .catch(() => {
        if (active && !eventReceived) setSession(null)
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(email, password) {
    const result = await signInWithEmail(email, password)
    if (!result.error && result.data?.session) {
      setIsDemo(false)
      setSession(result.data.session)
    }
    return result
  }

  async function signUp(email, password, fullName) {
    const result = await signUpWithEmail(email, password, fullName)
    if (result.error) return result
    if (result.data?.session) {
      setIsDemo(false)
      setSession(result.data.session)
    }
    return { ...result, needsEmailConfirmation: !result.data?.session }
  }

  async function signOut() {
    const result = isDemo ? { error: null } : await endSession()
    if (!result.error) {
      setSession(null)
      setIsDemo(false)
    }
    return result
  }

  function startDemo() {
    setIsDemo(true)
    setSession({
      user: {
        id: 'demo-user',
        email: 'demo@exemplo.invalid',
        user_metadata: { full_name: 'Paciente demonstração' },
      },
    })
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isAuthenticated: Boolean(session?.user),
        isLoading,
        isDemo,
        signIn,
        signUp,
        signOut,
        startDemo,
        signInGoogle: signInWithGoogle,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
