import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { subscribe } from '../lib/realtime'
import Layout from '../components/Layout'
import Badge from '../components/Badge'

export default function MyBookings() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

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

  return (
    <Layout>
      <h1 className="font-display text-2xl font-semibold mb-1">My bookings</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Live status of every request you've sent.</p>

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
                {b.rejection_reason && <p className="mt-2 text-sm" style={{ color: 'var(--danger)' }}>Admin note: {b.rejection_reason} Update your requirements in Settings if documents need correction.</p>}
              </div>
              <Badge status={b.status} />
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}
