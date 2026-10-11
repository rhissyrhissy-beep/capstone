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
        // the API answers 403 for blacklisted accounts, so reaching here means the account is in good standing
        if (me.role !== 'customer' || me.is_blacklisted) return clearSession()
        setSession({ access_token: token })
        setProfile(me)
      })
      .catch((error) => {
        if (error.status === 401 || error.status === 403) clearSession()
        else setSession({ access_token: token })
      })
      .finally(() => setLoading(false))
  }, [])

  // Re-read the profile after something changes it (age, submitted requirements, ...)
  async function refreshProfile() {
    const me = await api.get('/auth/me')
    setProfile(me)
    return me
  }

  async function signInWithPassword(email, password) {
    try {
      const data = await api.post('/auth/login', { email: email.trim().toLowerCase(), password, portal: 'customer' })
      setToken(data.access_token)
      resetRealtime()
      setSession({ access_token: data.access_token })
      setProfile(data.user)
      return { data }
    } catch (error) {
      return { error }
    }
  }

  async function signUpCustomer(fullName, email, phone, password) {
    try {
      const data = await api.post('/auth/signup', {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
        role: 'customer',
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
    <AuthContext.Provider value={{ session, profile, loading, signInWithPassword, signUpCustomer, resendVerification, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
