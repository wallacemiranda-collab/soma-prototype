import { createContext, useContext, useEffect, useState } from 'react'
import { demoSession, demoStore } from '../lib/demoStore'
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
  const [restoredDemo] = useState(() => Boolean(demoStore.read()))
  const [session, setSession] = useState(() =>
    restoredDemo ? demoSession() : null,
  )
  const [isLoading, setIsLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(restoredDemo)
  const [accessMode, setMode] = useState(() => {
    try {
      return sessionStorage.getItem('endo-access-mode') === 'doctor'
        ? 'doctor'
        : 'patient'
    } catch {
      return 'patient'
    }
  })

  function setAccessMode(value) {
    const mode = value === 'doctor' ? 'doctor' : 'patient'
    setMode(mode)
    try {
      sessionStorage.setItem('endo-access-mode', mode)
    } catch {
      // This is only a navigation preference, never an authorization claim.
    }
  }

  useEffect(() => {
    let active = true
    let eventReceived = false
    function applySession(nextSession, event = 'INITIAL_SESSION') {
      if (!active) return
      if (nextSession || event !== 'INITIAL_SESSION') {
        demoStore.clear()
        setSession(nextSession)
        setIsDemo(false)
      } else {
        const demo = Boolean(demoStore.read())
        setSession(demo ? demoSession() : null)
        setIsDemo(demo)
      }
      setIsLoading(false)
    }
    const subscription = onAuthStateChange((nextSession, event) => {
      eventReceived = true
      applySession(nextSession, event)
    })
    getCurrentSession()
      .then(({ session: current }) => {
        if (!eventReceived) applySession(current)
      })
      .catch(() => {
        if (!eventReceived) applySession(null)
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
      demoStore.clear()
      setIsDemo(false)
      setSession(result.data.session)
    }
    return result
  }

  async function signUp(email, password, fullName) {
    const result = await signUpWithEmail(email, password, fullName)
    if (result.error) return result
    if (result.data?.session) {
      demoStore.clear()
      setIsDemo(false)
      setSession(result.data.session)
    }
    return { ...result, needsEmailConfirmation: !result.data?.session }
  }

  async function signOut() {
    const result = isDemo ? { error: null } : await endSession()
    if (!result.error) {
      demoStore.clear()
      setSession(null)
      setIsDemo(false)
    }
    return result
  }

  function startDemo() {
    demoStore.start()
    setIsDemo(true)
    setSession(demoSession())
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isAuthenticated: Boolean(session?.user),
        isLoading,
        isDemo,
        accessMode,
        setAccessMode,
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
