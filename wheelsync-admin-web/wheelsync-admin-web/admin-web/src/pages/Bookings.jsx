import { useEffect, useState } from 'react'
import { Check, Printer, X } from 'lucide-react'
import { api } from '../lib/api'
import { subscribe } from '../lib/realtime'
import Layout from '../components/Layout'
import Badge from '../components/Badge'
import { printRentalPack } from '../lib/print'

const FILTERS = ['all', 'pending', 'accepted', 'ongoing', 'completed', 'rejected', 'cancelled']

export default function Bookings() {
  const [bookings, setBookings] = useState([])
  const [staff, setStaff] = useState([])
  const [filter, setFilter] = useState('pending')
  const [assignFor, setAssignFor] = useState(null)
  const [selectedStaff, setSelectedStaff] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('upcoming')
  const [loading, setLoading] = useState(true)
  const [busyBooking, setBusyBooking] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [rejectFor, setRejectFor] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')

  async function load() {
    setLoading(true)
    try {
      const [bookingList, staffList] = await Promise.all([
        api.get('/bookings', { status: filter, sort: 'created_desc' }),
        api.get('/admin/staff'),
      ])
      setBookings(bookingList)
      setStaff(staffList)
    } catch (error) {
      setActionError(error.message || 'Unable to load bookings.')
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    return subscribe('bookings', load)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  const visibleBookings = bookings
    .filter((booking) => `${booking.profiles?.full_name ?? ''} ${booking.profiles?.email ?? ''} ${booking.profiles?.phone ?? ''} ${booking.vehicles?.make ?? ''} ${booking.vehicles?.model ?? ''} ${booking.vehicles?.plate_number ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((first, second) => {
      if (sortBy === 'customer') return (first.profiles?.full_name ?? '').localeCompare(second.profiles?.full_name ?? '')
      if (sortBy === 'amount') return Number(second.total_amount || 0) - Number(first.total_amount || 0)
      if (sortBy === 'newest') return second.start_date.localeCompare(first.start_date)
      return first.start_date.localeCompare(second.start_date)
    })

  async function reject(booking, reason) {
    setBusyBooking(booking.id)
    setActionError('')
    setActionMessage('')
    try {
      await api.post(`/bookings/${booking.id}/reject`, { reason })
      setRejectFor(null)
      setRejectionReason('')
    } catch (error) {
      setActionError(error.message)
    }
    await load()
    setBusyBooking('')
  }

  async function printPack(booking) {
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) {
      setActionError('Allow pop-ups for this admin site to print documents.')
      return
    }
    try {
      const pack = await api.get(`/bookings/${booking.id}/print-pack`)
      printRentalPack(pack, printWindow)
    } catch (error) {
      printWindow.close()
      setActionError(`Could not prepare the print pack: ${error.message}`)
    }
  }

  async function sendApprovalEmail(booking) {
    setBusyBooking(booking.id)
    setActionError('')
    setActionMessage('')
    try {
      await api.post(`/bookings/${booking.id}/send-approval-email`)
      setActionMessage(`Approval email sent to ${booking.profiles?.email || 'the customer'}.`)
    } catch (error) {
      setActionError(`Booking is accepted, but email delivery failed: ${error.message}${error.status ? ` (HTTP ${error.status})` : ''}`)
    } finally {
      setBusyBooking('')
    }
  }

  async function confirmAccept(booking) {
    if (!selectedStaff || booking.profiles?.verification_status !== 'verified') return
    setBusyBooking(booking.id)
    setActionError('')
    setActionMessage('')

    try {
      await api.post(`/bookings/${booking.id}/accept`, { staff_id: selectedStaff })
    } catch (error) {
      const message = error.message || ''
      if (error.status === 409 && /no longer pending/i.test(message)) {
        setActionError('This booking is no longer pending. The list has been refreshed.')
        setAssignFor(null)
        setSelectedStaff('')
        await load()
      } else {
        setActionError(message.toLowerCase().includes('already reserved')
          ? 'This booking overlaps an accepted or ongoing rental, so it remains Pending. Resolve the conflicting booking or request different dates before accepting.'
          : message)
      }
      setBusyBooking('')
      return
    }

    await sendApprovalEmail(booking)

    setAssignFor(null)
    setSelectedStaff('')
    await load()
    setBusyBooking('')
  }

  return (
    <Layout>
      <h1 className="font-display text-2xl font-semibold mb-1">Bookings</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        Review requests from customers, accept them, and assign a staff member.
      </p>

      {actionError && <p role="alert" className="text-sm px-4 py-3 rounded-xl mb-4" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--danger)' }}>{actionError}</p>}
      {actionMessage && <p role="status" className="text-sm px-4 py-3 rounded-xl mb-4" style={{ background: 'rgba(74,222,128,0.12)', color: 'var(--success)' }}>{actionMessage}</p>}

      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTERS.map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className="px-3 py-1.5 rounded-full text-sm font-medium capitalize"
            style={{
              background: filter === status ? 'var(--gradient-primary)' : 'var(--bg-surface-2)',
              color: filter === status ? 'white' : 'var(--text-muted)',
            }}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <input aria-label="Search bookings" placeholder="Search customer, vehicle, or plate" value={search} onChange={(event) => setSearch(event.target.value)} className="px-3 py-2 text-sm flex-1 min-w-56" />
        <select aria-label="Sort bookings" value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="px-3 py-2 text-sm">
          <option value="upcoming">Date: upcoming first</option>
          <option value="newest">Date: latest first</option>
          <option value="customer">Customer: A to Z</option>
          <option value="amount">Amount: highest first</option>
        </select>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : visibleBookings.length === 0 ? (
        <div className="card p-8 text-center" style={{ color: 'var(--text-muted)' }}>No bookings in this view.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
                <th className="py-3 px-4 font-medium">Customer</th>
                <th className="py-3 px-4 font-medium">Vehicle</th>
                <th className="py-3 px-4 font-medium">Schedule</th>
                <th className="py-3 px-4 font-medium">Request</th>
                <th className="py-3 px-4 font-medium">Verification</th>
                <th className="py-3 px-4 font-medium">Amount</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="w-[220px] py-3 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleBookings.map((booking) => (
                <tr key={booking.id} style={{ borderTop: '1px solid var(--border-soft)' }}>
                  <td className="py-3 px-4 align-top">
                    <p className="font-medium">{booking.profiles?.full_name}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{booking.profiles?.phone} · Age {booking.profiles?.age ?? 'Not provided'}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{booking.profiles?.email}</p>
                  </td>
                  <td className="py-3 px-4 align-top">
                    <p className="font-medium">{booking.vehicles?.make} {booking.vehicles?.model}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{booking.vehicles?.plate_number}</p>
                  </td>
                  <td className="py-3 px-4 align-top whitespace-nowrap">
                    <p>{booking.start_date} · {booking.pickup_time?.slice(0, 5) || '—'}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>to {booking.end_date} · {booking.return_time?.slice(0, 5) || '—'}</p>
                  </td>
                  <td className="py-3 px-4 align-top">
                    <p className="capitalize">{String(booking.service_type || 'self_drive').replaceAll('_', ' ')}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{booking.pickup_location || 'No pickup required'} · {Number(booking.distance_km || 0).toLocaleString()} km</p>
                    {booking.notes && <p className="text-xs mt-1 italic max-w-56 whitespace-normal" style={{ color: 'var(--text-faint)' }}>&quot;{booking.notes}&quot;</p>}
                    {booking.rejection_reason && <p className="text-xs mt-1 max-w-56 whitespace-normal" style={{ color: 'var(--danger)' }}>Reason: {booking.rejection_reason}</p>}
                    {booking.inspections?.map((inspection) => (
                      <p key={inspection.id} className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                        {inspection.type === 'pre_rental' ? 'Pre' : 'Post'}-rental inspection · Fee ₱{Number(inspection.damage_fee || 0).toLocaleString()}
                      </p>
                    ))}
                  </td>
                  <td className="py-3 px-4 align-top">
                    <p style={{ color: booking.profiles?.verification_status === 'verified' ? 'var(--success)' : 'var(--warning)' }}>{booking.profiles?.verification_status ?? 'unsubmitted'}</p>
                    {booking.profiles?.id_type && <p className="text-xs mt-1 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{booking.profiles.id_type} {booking.profiles.id_number}</p>}
                    {booking.profiles?.second_id_type && <p className="text-xs mt-1 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{booking.profiles.second_id_type} {booking.profiles.second_id_number}</p>}
                  </td>
                  <td className="py-3 px-4 align-top whitespace-nowrap font-medium">₱{Number(booking.total_amount || 0).toLocaleString()}</td>
                  <td className="py-3 px-4 align-top"><Badge status={booking.status} /></td>
                  <td className="w-[220px] py-3 px-4 align-top">
                    {(booking.status === 'pending' || booking.status === 'rejected') && (assignFor === booking.id ? (
                      <div className="grid min-w-40 gap-2">
                        <select value={selectedStaff} onChange={(event) => setSelectedStaff(event.target.value)} className="px-2 py-2 text-xs">
                          <option value="">Assign staff…</option>
                          {staff.map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}
                        </select>
                        <button onClick={() => confirmAccept(booking)} disabled={!selectedStaff || booking.profiles?.verification_status !== 'verified' || busyBooking === booking.id} className="btn-primary w-full px-3 py-2 text-xs">
                          {busyBooking === booking.id ? 'Accepting…' : booking.status === 'rejected' ? 'Confirm accept again' : 'Confirm accept'}
                        </button>
                        {booking.profiles?.verification_status !== 'verified' && <span className="text-xs" style={{ color: 'var(--warning)' }}>Verify customer first.</span>}
                        <button onClick={() => { setAssignFor(null); setSelectedStaff('') }} className="btn-ghost w-full px-3 py-2 text-xs">Cancel</button>
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        <button onClick={() => setAssignFor(booking.id)} disabled={busyBooking === booking.id} className="btn-primary flex w-full items-center justify-center gap-2 px-3 py-2.5 text-xs whitespace-nowrap"><Check size={14} /> {booking.status === 'rejected' ? 'Accept again' : 'Accept'}</button>
                        <button onClick={() => { setRejectFor(booking); setRejectionReason('') }} disabled={busyBooking === booking.id} className="btn-ghost flex w-full items-center justify-center gap-2 px-3 py-2.5 text-xs whitespace-nowrap"><X size={14} /> {booking.status === 'rejected' ? 'Reject again' : 'Reject'}</button>
                      </div>
                    ))}
                    {booking.status === 'accepted' && <button onClick={() => sendApprovalEmail(booking)} disabled={busyBooking === booking.id} className="btn-ghost mt-2 flex w-full items-center justify-center gap-1.5 px-3 py-2 text-xs">{busyBooking === booking.id ? 'Sending…' : 'Resend approval email'}</button>}
                    <button onClick={() => printPack(booking)} className="btn-ghost mt-2 flex w-full items-center justify-center gap-1.5 px-3 py-2 text-xs"><Printer size={14} /> Print rental pack</button>
                    {booking.assigned_staff_id && <p className="mt-2 text-xs" style={{ color: 'var(--text-faint)' }}>Assigned: {staff.find((member) => member.id === booking.assigned_staff_id)?.full_name ?? 'Staff member'}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rejectFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setRejectFor(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="reject-booking-title" className="card w-full max-w-lg p-5" onClick={(event) => event.stopPropagation()}>
            <h2 id="reject-booking-title" className="font-display text-lg font-semibold">{rejectFor.status === 'rejected' ? 'Reject booking again' : 'Reject booking'}</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Give the customer a reason and explain what they can update. This note will replace the previous rejection note.</p>
            <label className="mt-4 flex flex-col gap-1 text-sm">Reason<textarea rows={4} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} maxLength={2000} required placeholder="For example, please upload a clear, unexpired ID." className="px-3 py-2" /></label>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setRejectFor(null)} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
              <button onClick={() => reject(rejectFor, rejectionReason.trim())} disabled={!rejectionReason.trim() || busyBooking === rejectFor.id} className="btn-primary px-4 py-2 text-sm">{busyBooking === rejectFor.id ? 'Sending…' : rejectFor.status === 'rejected' ? 'Reject again and notify' : 'Reject and notify'}</button>
            </div>
          </section>
        </div>
      )}
    </Layout>
  )
}