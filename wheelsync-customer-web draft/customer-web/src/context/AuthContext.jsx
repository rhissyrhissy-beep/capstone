import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (!error) setProfile(data)
    return data
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        const currentProfile = await loadProfile(session.user.id)
        if (currentProfile?.is_blacklisted) {
          await supabase.auth.signOut()
          setSession(null)
          setProfile(null)
        }
      }
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session?.user) {
        const currentProfile = await loadProfile(session.user.id)
        if (currentProfile?.is_blacklisted) {
          await supabase.auth.signOut()
          setSession(null)
          setProfile(null)
        }
      } else {
        setProfile(null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signInWithPassword(email, password) {
    const normalizedEmail = email.trim().toLowerCase()
    const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
    if (error) return { error }
    const p = await loadProfile(data.user.id)
    if (!p || p.role !== 'customer') {
      await supabase.auth.signOut()
      return { error: { message: 'This login is for customer accounts only.' } }
    }
    if (p?.is_blacklisted) {
      await supabase.auth.signOut()
      return { error: { message: 'This account is currently restricted. Please contact Pardz Car Rental.' } }
    }
    return { data }
  }

  async function signUpCustomer(fullName, email, phone, password) {
    const normalizedEmail = email.trim().toLowerCase()
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { data: { full_name: fullName.trim(), phone: phone.trim(), role: 'customer' } },
    })
    return { data, error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signInWithPassword, signUpCustomer, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
