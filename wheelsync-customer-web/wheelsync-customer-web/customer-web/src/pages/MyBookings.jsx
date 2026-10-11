import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { subscribe } from '../lib/realtime'
import Layout from '../components/Layout'
import Badge from '../components/Badge'

export default function MyBookings() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingBooking, setEditingBooking] = useState(null)
  const [vehicles, setVehicles] = useState([])
  const [editForm, setEditForm] = useState(null)
  const [editError, setEditError] = useState('')
  const [editBusy, setEditBusy] = useState(false)
  const [editNotice, setEditNotice] = useState('')

  async function load() {
    setLoading(true)
    try {
      setBookings(await api.get('/bookings'))
    } catch (error) {
      console.error('Unable to load bookings:', error.message)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    return subscribe('bookings', load)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function startEditing(booking) {
    setEditingBooking(booking)
    setEditError('')
    setEditNotice('')
    setEditForm({
      vehicle_id: booking.vehicle_id,
      start_date: booking.start_date,
      end_date: booking.end_date,
      pickup_time: booking.pickup_time?.slice(0, 5) || '',
      return_time: booking.return_time?.slice(0, 5) || '',
      pickup_location: booking.pickup_location || '',
      service_type: booking.service_type || 'self_drive',
      distance_km: String(booking.distance_km ?? 0),
      notes: booking.notes || '',
    })
    try {
      setVehicles(await api.get('/vehicles'))
    } catch (error) {
      setEditError(`Could not load available vehicles: ${error.message}`)
      setVehicles([])
    }
  }

  async function resubmitBooking(event) {
    event.preventDefault()
    if (!editingBooking || !editForm) return
    setEditBusy(true)
    setEditError('')
    try {
      await api.put(`/bookings/${editingBooking.id}/resubmit`, {
        ...editForm,
        pickup_time: editForm.pickup_time || null,
        return_time: editForm.return_time || null,
        pickup_location: editForm.service_type === 'pickup_dropoff' ? editForm.pickup_location.trim() : null,
        distance_km: Number(editForm.distance_km),
        notes: editForm.notes.trim() || null,
      })
      setEditingBooking(null)
      setEditNotice('Your updated booking was sent to the admin for review.')
      await load()
    } catch (error) {
      setEditError(error.message)
    } finally {
      setEditBusy(false)
    }
  }

  return (
    <Layout>
      <h1 className="font-display text-2xl font-semibold mb-1">My bookings</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Live status of every request you've sent.</p>
      {editNotice && <p role="status" className="card mb-4 px-4 py-3 text-sm" style={{ color: 'var(--success)' }}>{editNotice}</p>}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : bookings.length === 0 ? (
        <div className="card p-8 text-center" style={{ color: 'var(--text-muted)' }}>No bookings yet — go browse vehicles to get started.</div>
      ) : (
        <div className="grid gap-4">
          {bookings.map((b) => (
            <div key={b.id} className="card p-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{b.vehicles?.make} {b.vehicles?.model} <span style={{ color: 'var(--text-muted)' }}>({b.vehicles?.plate_number})</span></p>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{b.start_date} {b.pickup_time?.slice(0, 5) || ''} → {b.end_date} {b.return_time?.slice(0, 5) || ''} · Pickup: {b.pickup_location}</p>
                {b.rejection_reason && <p className="mt-2 text-sm" style={{ color: 'var(--danger)' }}>Admin note: {b.rejection_reason}</p>}
              </div>
              <div className="flex flex-col items-end gap-3">
                <Badge status={b.status} />
                {b.status === 'rejected' && (
                  <button onClick={() => startEditing(b)} className="btn-primary px-3 py-2 text-sm">
                    Edit and resubmit
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {editingBooking && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4" onClick={() => setEditingBooking(null)}>
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-rejected-booking-title"
            onSubmit={resubmitBooking}
            onClick={(event) => event.stopPropagation()}
            className="card my-4 grid w-full max-w-2xl gap-4 p-5"
          >
            <div>
              <h2 id="edit-rejected-booking-title" className="font-display text-lg font-semibold">Update rejected booking</h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                Update the details requested by the admin. Your edited booking will return to Pending for review.
              </p>
            </div>
            {editError && <p role="alert" className="rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--danger)' }}>{editError}</p>}
            <label className="flex flex-col gap-1 text-sm">Vehicle
              <select required value={editForm.vehicle_id} onChange={(event) => setEditForm({ ...editForm, vehicle_id: event.target.value })} className="px-3 py-2">
                {!vehicles.some((vehicle) => vehicle.id === editingBooking.vehicle_id) && (
                  <option value={editingBooking.vehicle_id}>
                    {editingBooking.vehicles?.make} {editingBooking.vehicles?.model} (current vehicle)
                  </option>
                )}
                {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.make} {vehicle.model} · {vehicle.plate_number}</option>)}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">Start date<input type="date" required min={todayKey()} value={editForm.start_date} onChange={(event) => setEditForm({ ...editForm, start_date: event.target.value })} className="px-3 py-2" /></label>
              <label className="flex flex-col gap-1 text-sm">End date<input type="date" required min={editForm.start_date || todayKey()} value={editForm.end_date} onChange={(event) => setEditForm({ ...editForm, end_date: event.target.value })} className="px-3 py-2" /></label>
              <label className="flex flex-col gap-1 text-sm">Pickup time<input type="time" value={editForm.pickup_time} onChange={(event) => setEditForm({ ...editForm, pickup_time: event.target.value })} className="px-3 py-2" /></label>
              <label className="flex flex-col gap-1 text-sm">Return time<input type="time" value={editForm.return_time} onChange={(event) => setEditForm({ ...editForm, return_time: event.target.value })} className="px-3 py-2" /></label>
              <label className="flex flex-col gap-1 text-sm">Service
                <select value={editForm.service_type} onChange={(event) => setEditForm({ ...editForm, service_type: event.target.value })} className="px-3 py-2">
                  <option value="self_drive">Self drive</option>
                  <option value="with_driver">With driver</option>
                  <option value="pickup_dropoff">Pickup / drop-off</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">Distance (km)<input type="number" required min="0" step="0.1" value={editForm.distance_km} onChange={(event) => setEditForm({ ...editForm, distance_km: event.target.value })} className="px-3 py-2" /></label>
              {editForm.service_type === 'pickup_dropoff' && (
                <label className="flex flex-col gap-1 text-sm sm:col-span-2">Pickup / drop-off location<input required maxLength={500} value={editForm.pickup_location} onChange={(event) => setEditForm({ ...editForm, pickup_location: event.target.value })} className="px-3 py-2" /></label>
              )}
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">Notes<textarea rows={3} maxLength={2000} value={editForm.notes} onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })} className="px-3 py-2" /></label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" disabled={editBusy} onClick={() => setEditingBooking(null)} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={editBusy} className="btn-primary px-4 py-2 text-sm">{editBusy ? 'Sending…' : 'Resubmit for review'}</button>
            </div>
          </form>
        </div>
      )}
    </Layout>
  )
}

function todayKey() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}
