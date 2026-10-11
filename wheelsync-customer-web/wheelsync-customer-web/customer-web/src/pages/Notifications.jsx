import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { subscribe } from '../lib/realtime'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'

const ACCEPTED_BOOKING_MESSAGE = 'Your booking requirements are approved and verified. Please visit Pardz Car Rental at Zone 7, Kauswagan Highway, Cagayan de Oro City. Submit one physical ID to our admin for vehicle release; it will be returned to you when the vehicle is returned.'

function notificationContent(item) {
  const isAcceptedBooking = item.title === 'Booking approved'
    || (item.title === 'Booking status updated' && /\baccepted\b/i.test(item.body ?? ''))

  if (isAcceptedBooking) {
    return { title: 'Booking accepted: requirements approved', body: ACCEPTED_BOOKING_MESSAGE }
  }
  return { title: item.title, body: item.body }
}

export default function Notifications() {
  const { profile } = useAuth()
  const [items, setItems] = useState([])
  const [error, setError] = useState('')

  async function load() {
    try {
      setItems(await api.get('/notifications'))
      setError('')
    } catch (loadError) {
      setError(loadError.message)
    }
  }

  useEffect(() => {
    load()
    return subscribe('notifications', load)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id])

  async function markRead(id) {
    try {
      await api.post(`/notifications/${id}/read`)
    } catch (updateError) {
      setError(updateError.message)
      return
    }
    load()
  }

  return (
    <Layout>
      <h1 className="font-display text-2xl font-semibold mb-1">Notifications</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Booking updates and reminders from Pardz Car Rental.</p>
      {error && <p role="alert" className="text-sm px-4 py-3 rounded-xl mb-4" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--danger)' }}>{error}</p>}
      <div className="grid gap-3">
        {items.map((item) => (
          <button key={item.id} onClick={() => markRead(item.id)} className="card p-4 text-left" style={{ borderColor: item.is_read ? 'var(--border-soft)' : 'var(--nebula-3)' }}>
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-medium">{notificationContent(item).title}</p><p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{notificationContent(item).body}</p></div>
              {!item.is_read && <span className="badge badge-ongoing">New</span>}
            </div>
          </button>
        ))}
        {items.length === 0 && <div className="card p-8 text-center" style={{ color: 'var(--text-muted)' }}>No notifications yet.</div>}
      </div>
    </Layout>
  )
}
