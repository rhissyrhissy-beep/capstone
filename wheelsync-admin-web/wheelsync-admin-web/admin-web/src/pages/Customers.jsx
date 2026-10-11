import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { api } from '../lib/api'
import Layout from '../components/Layout'
import { buildChurnFeatures, predictChurn } from '../lib/churnModel'
import { printCustomerDocuments } from '../lib/print'

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [documents, setDocuments] = useState({})
  const [documentLoading, setDocumentLoading] = useState(false)
  const [rejectingCustomer, setRejectingCustomer] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [verificationError, setVerificationError] = useState('')
  const [savingVerification, setSavingVerification] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [customerList, history] = await Promise.all([
        api.get('/admin/customers'),
        api.get('/admin/customers/booking-history'),
      ])
      setCustomers(customerList.map((customer) => {
        const features = buildChurnFeatures(customer.id, history)
        return { ...customer, churnFeatures: features, churn: predictChurn(features) }
      }))
    } catch (error) {
      console.error('Unable to load customers:', error.message)
      setCustomers([])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggleBlacklist(id, current) {
    try {
      await api.patch(`/admin/customers/${id}/blacklist`, { is_blacklisted: !current })
    } catch (error) {
      console.error('Unable to update blacklist:', error.message)
    }
    load()
  }

  async function reviewVerification(customer, status) {
    const reason = rejectionReason.trim()
    if (status === 'rejected' && !reason) {
      setVerificationError('Enter a reason so the customer knows what to correct.')
      return
    }
    setSavingVerification(true)
    setVerificationError('')
    try {
      // For a rejection the server also sends the customer their "Requirements need correction" notification.
      await api.post(`/admin/customers/${customer.id}/verification`, { status, reason: status === 'rejected' ? reason : null })
    } catch (error) {
      setVerificationError(`Could not update verification: ${error.message}`)
      setSavingVerification(false)
      return
    }
    setSelectedCustomer({ ...customer, verification_status: status, verification_notes: status === 'rejected' ? reason : null })
    setRejectingCustomer(null)
    setRejectionReason('')
    setSavingVerification(false)
    load()
  }

  async function openCustomer(customer) {
    setSelectedCustomer(customer)
    setDocuments({})
    setDocumentLoading(true)
    let signedDocuments = {}
    try {
      signedDocuments = await api.get(`/admin/customers/${customer.id}/documents`)
    } catch (error) {
      console.error('Unable to load customer documents:', error.message)
    }
    setDocuments(signedDocuments)
    setDocumentLoading(false)
  }

  function printRequirements() {
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) {
      setVerificationError('Allow pop-ups for this admin site to print documents.')
      return
    }
    printCustomerDocuments(selectedCustomer, documents, printWindow)
  }

  return (
    <Layout>
      <h1 className="font-display text-2xl font-semibold mb-1">Customers</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        Customer history and churn-risk signals calculated from completed rentals.
      </p>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
                <th className="py-3 px-5 font-medium">Name</th>
                <th className="py-3 px-5 font-medium">Email</th>
                <th className="py-3 px-5 font-medium">Phone</th>
                <th className="py-3 px-5 font-medium">ID verification</th>
                <th className="py-3 px-5 font-medium">Churn prediction</th>
                <th className="py-3 px-5 font-medium">Status</th>
                <th className="py-3 px-5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} style={{ borderTop: '1px solid var(--border-soft)' }}>
                  <td className="py-3 px-5"><button onClick={() => openCustomer(c)} className="font-medium hover:underline" style={{ color: 'var(--nebula-3)' }}>{c.full_name}</button></td>
                  <td className="py-3 px-5">{c.email}</td>
                  <td className="py-3 px-5">{c.phone || '—'}</td>
                  <td className="py-3 px-5">
                    <span className={`badge ${c.verification_status === 'verified' ? 'badge-accepted' : c.verification_status === 'rejected' ? 'badge-rejected' : 'badge-pending'}`}>
                      {c.verification_status}
                    </span>
                  </td>
                  <td className="py-3 px-5">
                    {c.churn?.probability == null ? (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.churn.label}</span>
                    ) : (
                      <div title={`Last rental gap: ${c.churnFeatures.days_since_last_rental} days; rentals: ${c.churnFeatures.total_rentals_completed}; average gap: ${c.churnFeatures.avg_days_between_rentals} days; late-return rate: ${(c.churnFeatures.late_return_rate * 100).toFixed(0)}%; preferred service: ${c.churnFeatures.preferred_service_type}; tenure: ${c.churnFeatures.customer_tenure_days} days; spent: P${c.churnFeatures.total_amount_spent.toLocaleString()}`}>
                        <span className={`badge ${c.churn.label === 'At Risk of Churn' ? 'badge-rejected' : 'badge-accepted'}`}>
                          {c.churn.label}
                        </span>
                        <span className="block text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                          {(c.churn.probability * 100).toFixed(0)}% risk
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-5">
                    <span className={`badge ${c.is_blacklisted ? 'badge-rejected' : 'badge-accepted'}`}>
                      {c.is_blacklisted ? 'Blacklisted' : 'Good standing'}
                    </span>
                  </td>
                  <td className="py-3 px-5 text-right">
                    <button onClick={() => toggleBlacklist(c.id, c.is_blacklisted)} className="btn-ghost px-3 py-1.5 text-xs">
                      {c.is_blacklisted ? 'Remove from blacklist' : 'Blacklist'}
                    </button>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>No customers yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/70 flex items-start justify-center p-3 sm:p-6 z-50 overflow-y-auto" onClick={() => { setSelectedCustomer(null); setRejectingCustomer(null) }}>
          <section className="card p-4 sm:p-6 w-full max-w-5xl my-4" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="font-display text-xl font-semibold">Customer verification</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Review customer details and submitted documents.</p>
              </div>
              <button onClick={() => { setSelectedCustomer(null); setRejectingCustomer(null) }} className="btn-ghost px-3 py-2 text-sm">Close</button>
            </div>
            {verificationError && <p role="alert" className="text-sm px-4 py-3 rounded-xl mb-4" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--danger)' }}>{verificationError}</p>}
            <div className="grid sm:grid-cols-3 gap-3 mb-5">
              <div className="card p-3"><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Full name</p><p className="font-medium mt-1">{selectedCustomer.full_name}</p></div>
              <div className="card p-3"><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Phone number</p><p className="font-medium mt-1">{selectedCustomer.phone || 'Not provided'}</p></div>
              <div className="card p-3"><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Age</p><p className="font-medium mt-1">{selectedCustomer.age ?? 'Not provided'}</p></div>
              <div className="card p-3"><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Email</p><p className="font-medium mt-1 break-all">{selectedCustomer.email}</p></div>
              <div className="card p-3"><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Address</p><p className="font-medium mt-1">{selectedCustomer.address || 'Not provided'}</p></div>
              <div className="card p-3"><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Primary ID</p><p className="font-medium mt-1">{selectedCustomer.id_type || 'Not provided'}</p><p className="text-sm">{selectedCustomer.id_number || 'No number'}</p></div>
              <div className="card p-3"><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Second ID</p><p className="font-medium mt-1">{selectedCustomer.second_id_type || 'Not provided'}</p><p className="text-sm">{selectedCustomer.second_id_number || 'No number'}</p></div>
              <div className="card p-3"><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Verification status</p><span className={`badge mt-2 ${selectedCustomer.verification_status === 'verified' ? 'badge-accepted' : selectedCustomer.verification_status === 'rejected' ? 'badge-rejected' : 'badge-pending'}`}>{selectedCustomer.verification_status}</span></div>
            </div>
            <h3 className="font-display font-semibold mb-3">Submitted documents</h3>
            {documentLoading ? <p className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading documents…</p> : (
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  ['primaryId', `Primary ID · ${selectedCustomer.id_type || 'Type not provided'} (${selectedCustomer.id_number || 'No number'})`],
                  ['secondId', `Second ID · ${selectedCustomer.second_id_type || 'Type not provided'} (${selectedCustomer.second_id_number || 'No number'})`],
                  ['address', 'Proof of address'],
                  ['income', 'Proof of income'],
                  ['extra1', 'Additional photo 1 (optional)'],
                  ['extra2', 'Additional photo 2 (optional)'],
                ].map(([key, label]) => (
                  <div key={key} className="card p-3">
                    <p className="text-sm font-medium mb-2">{label}</p>
                    {documents[key] ? <iframe title={label} src={documents[key]} className="w-full h-56 rounded-lg" /> : <div className="h-56 flex items-center justify-center rounded-lg text-sm" style={{ background: 'var(--bg-surface-2)', color: 'var(--text-muted)' }}>Document not submitted</div>}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button onClick={printRequirements} disabled={documentLoading || !Object.values(documents).some(Boolean)} className="btn-ghost inline-flex items-center gap-2 px-4 py-2 text-sm"><Printer size={16} /> Print submitted requirements</button>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              {selectedCustomer.verification_status !== 'verified' && <>
                <button onClick={() => { setRejectingCustomer(selectedCustomer); setRejectionReason(''); setVerificationError('') }} className="btn-ghost px-4 py-2 text-sm">Reject documents</button>
                <button onClick={() => reviewVerification(selectedCustomer, 'verified')} disabled={savingVerification || !selectedCustomer.id_photo_path || !selectedCustomer.second_id_photo_path || !selectedCustomer.proof_of_address_path || !selectedCustomer.proof_of_income_path} className="btn-primary px-4 py-2 text-sm">{savingVerification ? 'Saving…' : 'Verify customer'}</button>
                {(!selectedCustomer.id_photo_path || !selectedCustomer.second_id_photo_path || !selectedCustomer.proof_of_address_path || !selectedCustomer.proof_of_income_path) && <p className="text-xs self-center" style={{ color: 'var(--warning)' }}>All four documents are required before verification.</p>}
              </>}
              {selectedCustomer.verification_status === 'verified' && <span className="text-sm self-center" style={{ color: 'var(--success)' }}>Documents verified</span>}
            </div>
            {rejectingCustomer?.id === selectedCustomer.id && (
              <div className="card p-4 grid gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  Reason for rejection
                  <textarea
                    required
                    rows={3}
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    placeholder="For example, the government ID photo is blurry or expired."
                    className="px-3 py-2"
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setRejectingCustomer(null)} disabled={savingVerification} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
                  <button onClick={() => reviewVerification(selectedCustomer, 'rejected')} disabled={savingVerification} className="btn-primary px-4 py-2 text-sm">{savingVerification ? 'Sending…' : 'Reject and notify customer'}</button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </Layout>
  )
}
