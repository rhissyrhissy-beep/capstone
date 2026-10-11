import Layout from '../components/Layout'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth } from '../context/AuthContext'

export default function Settings() {
  const { profile } = useAuth()

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="font-display text-2xl font-semibold mb-1">Settings</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Manage your account preferences.</p>
        <div className="grid gap-4">
          <section className="card p-5">
            <h2 className="font-display font-semibold mb-4">Account information</h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div><p style={{ color: 'var(--text-muted)' }}>Full name</p><p className="font-medium mt-1">{profile?.full_name || 'Not provided'}</p></div>
              <div><p style={{ color: 'var(--text-muted)' }}>Email</p><p className="font-medium mt-1">{profile?.email || 'Not provided'}</p></div>
              <div><p style={{ color: 'var(--text-muted)' }}>Phone</p><p className="font-medium mt-1">{profile?.phone || 'Not provided'}</p></div>
              <div><p style={{ color: 'var(--text-muted)' }}>Verification</p><p className="font-medium mt-1 capitalize">{profile?.verification_status || 'unsubmitted'}</p></div>
            </div>
          </section>
          <section className="card p-5 flex items-center justify-between gap-4">
            <div><h2 className="font-display font-semibold">Appearance</h2><p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Choose light or dark mode.</p></div>
            <ThemeToggle />
          </section>
        </div>
      </div>
    </Layout>
  )
}
