import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import Badge from '../components/Badge'

const FILTERS = ['all', 'pending', 'accepted', 'ongoing', 'completed', 'rejected', 'cancelled']

export default function Bookings() {
  const { profile } = useAuth()
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
  const [inspectionFeeUnavailable, setInspectionFeeUnavailable] = useState(false)

  async function load() {
    setLoading(true)
    let query = supabase
      .from('bookings')
      .select('id, start_date, end_date, pickup_time, return_time, status, total_amount, distance_km, service_type, pickup_location, notes, customer_id, vehicle_id, assigned_staff_id, profiles:customer_id(full_name, email, phone, age, id_type, id_number, second_id_type, second_id_number, verification_status), vehicles(make, model, plate_number), inspections(id, type, damage_notes, odometer_reading, fuel_level, created_at)')
      .order('created_at', { ascending: false })
    if (filter !== 'all') query = query.eq('status', filter)
    let [{ data, error: bookingsError }, { data: staffList, error: staffError }] = await Promise.all([
      query,
      supabase.from('profiles').select('id, full_name').eq('role', 'staff'),
    ])
    if (!bookingsError && data?.length) {
      const { data: inspectionFees, error: inspectionFeeError } = await supabase
        .from('bookings')
        .select('id, inspections(id, damage_fee)')
        .in('id', data.map((booking) => booking.id))
      if (inspectionFeeError?.message.includes('damage_fee')) {
        setInspectionFeeUnavailable(true)
      } else if (inspectionFeeError) {
        bookingsError = inspectionFeeError
      } else {
        setInspectionFeeUnavailable(false)
        const feesByBooking = new Map((inspectionFees ?? []).map((booking) => [booking.id, booking.inspections ?? []]))
        data = (data ?? []).map((booking) => ({
          ...booking,
          inspections: (booking.inspections ?? []).map((inspection) => ({
            ...inspection,
            damage_fee: feesByBooking.get(booking.id)?.find((fee) => fee.id === inspection.id)?.damage_fee,
          })),
        }))
      }
    }
    if (bookingsError || staffError) {
      setActionError(bookingsError?.message || staffError?.message || 'Unable to load bookings.')
    } else {
      setBookings(data ?? [])
      setStaff(staffList ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel('admin-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
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

  async function reject(booking) {
    setBusyBooking(booking.id)
    setActionError('')
    setActionMessage('')
    const { error } = await supabase.from('bookings').update({
      status: 'rejected', decided_by: profile.id, decided_at: new Date().toISOString(),
    }).eq('id', booking.id).eq('status', 'pending')
    if (error) setActionError(error.message)
    await load()
    setBusyBooking('')
  }

  async function sendApprovalEmail(booking) {
    setBusyBooking(booking.id)
    setActionError('')
    setActionMessage('')
    try {
      const { error } = await supabase.functions.invoke('send-booking-accepted-email', {
        body: { booking_id: booking.id },
      })
      if (!error) {
        setActionMessage(`Approval email sent to ${booking.profiles?.email || 'the customer'}.`)
        return
      }

      let details = ''
      if (error.context instanceof Response) {
        try {
          const responseBody = await error.context.clone().json()
          details = responseBody?.error || responseBody?.message || ''
        } catch {
          details = ''
        }
      }

      const explanation = details
        ? `${details} (HTTP ${error.context.status})`
        : `${error.message}. Confirm that the send-booking-accepted-email function is deployed to the same Supabase project configured for the admin app.`
      setActionError(`Booking is accepted, but email delivery failed: ${explanation}`)
    } catch (error) {
      setActionError(`Booking is accepted, but the email function could not be reached: ${error.message}. Check the network and confirm the function is deployed to the configured Supabase project.`)
    } finally {
      setBusyBooking('')
    }
  }

  async function confirmAccept(booking) {
    if (!selectedStaff || booking.profiles?.verification_status !== 'verified') return
    setBusyBooking(booking.id)
    setActionError('')
    setActionMessage('')

    const { data: updatedBooking, error } = await supabase.from('bookings').update({
      status: 'accepted',
      assigned_staff_id: selectedStaff,
      decided_by: profile.id,
      decided_at: new Date().toISOString(),
    }).eq('id', booking.id).eq('status', 'pending').select('id').maybeSingle()

    if (error) {
      setActionError(error.message.toLowerCase().includes('already reserved')
        ? 'This booking overlaps an accepted or ongoing rental, so it remains Pending. Resolve the conflicting booking or request different dates before accepting.'
        : error.message)
      setBusyBooking('')
      return
    }
    if (!updatedBooking) {
      setActionError('This booking is no longer pending. The list has been refreshed.')
      setAssignFor(null)
      setSelectedStaff('')
      await load()
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
      {inspectionFeeUnavailable && <p role="status" className="text-sm px-4 py-3 rounded-xl mb-4" style={{ background: 'rgba(251,191,36,0.12)', color: 'var(--warning)' }}>Inspection fees are not available until the Supabase damage_fee migration is applied.</p>}
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
                <th className="py-3 px-4 font-medium">Actions</th>
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
                    {booking.inspections?.map((inspection) => (
                      <p key={inspection.id} className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                        {inspection.type === 'pre_rental' ? 'Pre' : 'Post'}-rental inspection · Fee {inspectionFeeUnavailable ? 'unavailable' : `₱${Number(inspection.damage_fee || 0).toLocaleString()}`}
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
                  <td className="py-3 px-4 align-top">
                    {booking.status === 'pending' && (assignFor === booking.id ? (
                      <div className="flex flex-col gap-2 min-w-40">
                        <select value={selectedStaff} onChange={(event) => setSelectedStaff(event.target.value)} className="px-2 py-2 text-xs">
                          <option value="">Assign staff…</option>
                          {staff.map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}
                        </select>
                        <button onClick={() => confirmAccept(booking)} disabled={!selectedStaff || booking.profiles?.verification_status !== 'verified' || busyBooking === booking.id} className="btn-primary px-3 py-2 text-xs">
                          {busyBooking === booking.id ? 'Accepting…' : 'Confirm accept'}
                        </button>
                        {booking.profiles?.verification_status !== 'verified' && <span className="text-xs" style={{ color: 'var(--warning)' }}>Verify customer first.</span>}
                        <button onClick={() => { setAssignFor(null); setSelectedStaff('') }} className="btn-ghost px-3 py-2 text-xs">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-start gap-2">
                        <button onClick={() => setAssignFor(booking.id)} disabled={busyBooking === booking.id} className="btn-primary px-3 py-2 text-xs flex items-center gap-1.5"><Check size={14} /> Accept</button>
                        <button onClick={() => reject(booking)} disabled={busyBooking === booking.id} className="btn-ghost px-3 py-2 text-xs flex items-center gap-1.5"><X size={14} /> Reject</button>
                      </div>
                    ))}
                    {booking.status === 'accepted' && <button onClick={() => sendApprovalEmail(booking)} disabled={busyBooking === booking.id} className="btn-ghost px-3 py-2 text-xs">{busyBooking === booking.id ? 'Sending…' : 'Resend approval email'}</button>}
                    {booking.assigned_staff_id && <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Assigned: {staff.find((member) => member.id === booking.assigned_staff_id)?.full_name ?? 'Staff member'}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}