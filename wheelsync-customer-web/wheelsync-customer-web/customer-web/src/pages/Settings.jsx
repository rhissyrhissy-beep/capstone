import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import Layout from '../components/Layout'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth } from '../context/AuthContext'

export default function Settings() {
  const { profile, refreshProfile } = useAuth()
  const [details, setDetails] = useState({ id_type: '', id_number: '', second_id_type: '', second_id_number: '', address: '' })
  const [files, setFiles] = useState({ firstId: null, secondId: null, address: null, income: null, extra1: null, extra2: null })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!profile) return
    setDetails({
      id_type: profile.id_type || '', id_number: profile.id_number || '',
      second_id_type: profile.second_id_type || '', second_id_number: profile.second_id_number || '',
      address: profile.address || '',
    })
  }, [profile])

  async function saveRequirements(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    const form = new FormData()
    Object.entries(details).forEach(([key, value]) => form.append(key, value.trim()))
    const uploadFields = {
      firstId: 'first_id', secondId: 'second_id', address: 'proof_of_address', income: 'proof_of_income',
      extra1: 'extra_document_1', extra2: 'extra_document_2',
    }
    Object.entries(uploadFields).forEach(([key, field]) => {
      if (files[key]) form.append(field, files[key])
    })
    try {
      const updated = await api.upload('/me/verification', form)
      await refreshProfile()
      setFiles({ firstId: null, secondId: null, address: null, income: null, extra1: null, extra2: null })
      setMessage(updated.verification_status === 'pending'
        ? 'Requirements sent for admin review. You can update them again at any time.'
        : 'Requirements updated.')
    } catch (saveError) {
      setError(saveError.message)
    }
    setSaving(false)
  }

  function fileField(label, fileKey, profileKey, optional = false) {
    return (
      <label className="flex flex-col gap-1 text-sm">
        {label}{optional ? ' (optional)' : ''}
        <input type="file" accept={fileKey.startsWith('extra') ? 'image/*' : 'image/*,.pdf'} onChange={(event) => setFiles((current) => ({ ...current, [fileKey]: event.target.files?.[0] || null }))} className="px-3 py-2" />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {files[fileKey]?.name || (profile?.[profileKey] ? 'Already on file; leave blank to keep it' : optional ? 'No photo submitted' : 'Required')}
        </span>
      </label>
    )
  }

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
          <section className="card p-5">
            <h2 className="font-display font-semibold">Customer requirements</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Update expired IDs or other details at any time. Changes are sent to the admin for review.</p>
            {profile?.verification_notes && <p role="status" className="mt-3 rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--danger)' }}>Admin note: {profile.verification_notes}</p>}
            {error && <p role="alert" className="mt-3 rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--danger)' }}>{error}</p>}
            {message && <p role="status" className="mt-3 rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(74,222,128,0.12)', color: 'var(--success)' }}>{message}</p>}
            <form onSubmit={saveRequirements} className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">Primary ID type<input required maxLength={100} value={details.id_type} onChange={(event) => setDetails({ ...details, id_type: event.target.value })} className="px-3 py-2" /></label>
              <label className="flex flex-col gap-1 text-sm">Primary ID number<input required maxLength={100} value={details.id_number} onChange={(event) => setDetails({ ...details, id_number: event.target.value })} className="px-3 py-2" /></label>
              {fileField('Primary ID photo', 'firstId', 'id_photo_path')}
              <label className="flex flex-col gap-1 text-sm">Second ID type<input required maxLength={100} value={details.second_id_type} onChange={(event) => setDetails({ ...details, second_id_type: event.target.value })} className="px-3 py-2" /></label>
              <label className="flex flex-col gap-1 text-sm">Second ID number<input required maxLength={100} value={details.second_id_number} onChange={(event) => setDetails({ ...details, second_id_number: event.target.value })} className="px-3 py-2" /></label>
              {fileField('Second ID photo', 'secondId', 'second_id_photo_path')}
              {fileField('Proof of address', 'address', 'proof_of_address_path')}
              {fileField('Proof of income', 'income', 'proof_of_income_path')}
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">Home / mailing address<input required maxLength={500} value={details.address} onChange={(event) => setDetails({ ...details, address: event.target.value })} className="px-3 py-2" /></label>
              {fileField('Additional ID / requirement photo 1', 'extra1', 'extra_document_1_path', true)}
              {fileField('Additional ID / requirement photo 2', 'extra2', 'extra_document_2_path', true)}
              <div className="sm:col-span-2 flex justify-end"><button type="submit" disabled={saving} className="btn-primary px-4 py-2 text-sm">{saving ? 'Sending…' : 'Save and send for review'}</button></div>
            </form>
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
