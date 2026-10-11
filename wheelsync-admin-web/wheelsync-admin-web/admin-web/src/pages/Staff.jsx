import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { api } from '../lib/api'
import Layout from '../components/Layout'

export default function Staff() {
  const [staff, setStaff] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      setStaff(await api.get('/admin/staff'))
    } catch (error) {
      console.error('Unable to load staff:', error.message)
    }
  }

  useEffect(() => { load() }, [])

  async function addStaff(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api.post('/admin/staff', {
        ...form,
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
      })
    } catch (createError) {
      setBusy(false)
      setError(createError.message)
      return
    }
    setBusy(false)
    setForm({ full_name: '', email: '', phone: '', password: '' })
    setShowForm(false)
    load()
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold mb-1">Staff accounts</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Staff can't self-register — create their login here and share the credentials.
          </p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
          {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? 'Close' : 'Add staff'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={addStaff} className="card p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {error && <p className="sm:col-span-2 text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
          <input required placeholder="Full name" className="px-3 py-2" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <input required type="email" placeholder="Email" className="px-3 py-2" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input placeholder="Phone (optional)" className="px-3 py-2" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input required type="password" minLength={6} placeholder="Temporary password" className="px-3 py-2" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <button type="submit" disabled={busy} className="btn-primary py-2 sm:col-span-2">{busy ? 'Creating…' : 'Create staff account'}</button>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
              <th className="py-3 px-5 font-medium">Name</th>
              <th className="py-3 px-5 font-medium">Email</th>
              <th className="py-3 px-5 font-medium">Phone</th>
              <th className="py-3 px-5 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} style={{ borderTop: '1px solid var(--border-soft)' }}>
                <td className="py-3 px-5">{s.full_name}</td>
                <td className="py-3 px-5">{s.email}</td>
                <td className="py-3 px-5">{s.phone || '—'}</td>
                <td className="py-3 px-5">{new Date(s.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {staff.length === 0 && (
              <tr><td colSpan={4} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>No staff accounts yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}
