import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import Badge from '../components/Badge'

export default function MyBookings() {
  const { profile } = useAuth()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('bookings')
      .select('id, start_date, end_date, pickup_time, return_time, status, pickup_location, vehicles(make, model, plate_number)')
      .eq('customer_id', profile.id)
      .order('created_at', { ascending: false })
    setBookings(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel('customer-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `customer_id=eq.${profile.id}` }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
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
              </div>
              <Badge status={b.status} />
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}
