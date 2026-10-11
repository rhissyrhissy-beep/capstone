import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from '../components/ThemeToggle'

export default function Signup() {
  const { signUpAdmin } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await signUpAdmin(fullName, email, password)
    setBusy(false)
    if (error) return setError(error.message)
    setDone(true)
    setTimeout(() => navigate('/login'), 2500)
  }

  return (
    <div className="min-h-screen galaxy-bg flex flex-col items-center justify-center p-6">
      <div className="absolute top-5 right-5"><ThemeToggle /></div>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center font-display font-bold text-2xl text-white mb-4"
            style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }}
          >
            W
          </div>
          <h1 className="font-display text-2xl font-semibold">Create admin account</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            One-time setup for Pardz Car Rental staff who manage WheelSync.
          </p>
        </div>

        {done ? (
          <div className="card p-6 text-center">
            <p style={{ color: 'var(--success)' }} className="font-medium">Account created 🎉</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              You can now sign in. Redirecting…
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card p-6 flex flex-col gap-4">
            {error && (
              <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--danger)' }}>
                {error}
              </p>
            )}
            <label className="flex flex-col gap-1 text-sm">
              Full name
              <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="px-3 py-2.5" placeholder="Juan Dela Cruz" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Email
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="px-3 py-2.5" placeholder="admin@pardzcarrental.com" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Password
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="px-3 py-2.5" placeholder="At least 6 characters" />
            </label>
            <button type="submit" disabled={busy} className="btn-primary py-2.5 mt-2">
              {busy ? 'Creating…' : 'Create account'}
            </button>
          </form>
        )}

        <p className="text-center text-sm mt-5" style={{ color: 'var(--text-muted)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--nebula-3)' }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
