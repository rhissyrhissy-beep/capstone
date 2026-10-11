import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CarFront } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from '../components/ThemeToggle'
import heroImage from '../assets/hero.png'

export default function Login() {
  const { signInWithPassword } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await signInWithPassword(email, password)
    setBusy(false)
    if (error) return setError(error.message)
    navigate('/')
  }

  return (
    <div className="min-h-screen galaxy-bg login-shell flex flex-col items-center justify-center p-6">
      <div className="absolute top-5 right-5"><ThemeToggle /></div>
      <div className="login-layout w-full max-w-6xl">
        <div className="login-brand-panel" style={{ backgroundImage: `url('/pardz-banner.png'), url(${heroImage})` }} aria-label="Pardz Car Rental" />
        <div className="w-full max-w-sm login-form-column">
        <div className="text-center mb-8">
          <div className="pardz-logo w-14 h-14 mx-auto rounded-2xl flex items-center justify-center text-white mb-4" aria-label="Pardz Car Rental"><CarFront size={30} strokeWidth={2.2} /></div>
          <h1 className="font-display text-2xl font-semibold">Welcome back</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Sign in to book your next ride with Pardz Car Rental.</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 flex flex-col gap-4">
          {error && <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--danger)' }}>{error}</p>}
          <label className="flex flex-col gap-1 text-sm">Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="px-3 py-2.5" placeholder="you@email.com" />
          </label>
          <label className="flex flex-col gap-1 text-sm">Password
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="px-3 py-2.5" placeholder="••••••••" />
          </label>
          <button type="submit" disabled={busy} className="pardz-signin btn-primary py-2.5 mt-2">{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>

        <p className="text-center text-sm mt-5" style={{ color: 'var(--text-muted)' }}>
          New to WheelSync? <Link to="/signup" style={{ color: 'var(--nebula-3)' }}>Create an account</Link>
        </p>
        </div>
      </div>
    </div>
  )
}
