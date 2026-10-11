import { createContext, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken, onUnauthorized } from '../lib/api'
import { resetRealtime } from '../lib/realtime'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  function clearSession() {
    setToken(null)
    setSession(null)
    setProfile(null)
    resetRealtime()
  }

  useEffect(() => {
    onUnauthorized(clearSession)
    const token = getToken()
    if (!token) {
      setLoading(false)
      return
    }
    api.get('/auth/me')
      .then((me) => {
        if (me.role !== 'admin') return clearSession()
        setSession({ access_token: token })
        setProfile(me)
      })
      .catch((error) => {
        // Only drop the session when the server says it is invalid, not on a temporary network error.
        if (error.status === 401 || error.status === 403) clearSession()
        else setSession({ access_token: token })
      })
      .finally(() => setLoading(false))
  }, [])

  async function signInWithPassword(email, password) {
    try {
      const data = await api.post('/auth/login', { email: email.trim().toLowerCase(), password, portal: 'admin' })
      setToken(data.access_token)
      resetRealtime()
      setSession({ access_token: data.access_token })
      setProfile(data.user)
      return { data }
    } catch (error) {
      return { error }
    }
  }

  async function signUpAdmin(fullName, email, password) {
    try {
      const data = await api.post('/auth/signup', {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role: 'admin',
      })
      return { data }
    } catch (error) {
      return { error }
    }
  }

  async function resendVerification(email) {
    try {
      const data = await api.post('/auth/resend-verification', { email: email.trim().toLowerCase() })
      return { data }
    } catch (error) {
      return { error }
    }
  }

  async function signOut() {
    clearSession()
  }

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, signInWithPassword, signUpAdmin, resendVerification, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
