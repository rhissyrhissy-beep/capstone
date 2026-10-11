import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { subscribe } from '../lib/realtime'
import Layout from '../components/Layout'

export default function Notifications() {
  const [items, setItems] = useState([])

  async function load() {
    try {
      setItems(await api.get('/notifications'))
    } catch (error) {
      console.error('Unable to load notifications:', error.message)
    }
  }

  useEffect(() => {
    load()
    return subscribe('notifications', load)
  }, [])

  async function markRead(id) {
    try {
      await api.post(`/notifications/${id}/read`)
    } catch (error) {
      console.error('Unable to mark notification read:', error.message)
    }
    load()
  }

  return (
    <Layout>
      <h1 className="font-display text-2xl font-semibold mb-1">Notifications</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Operational alerts, booking updates, and reminders.</p>
      <div className="grid gap-3">
        {items.map((item) => (
          <button key={item.id} onClick={() => markRead(item.id)} className="card p-4 text-left" style={{ borderColor: item.is_read ? 'var(--border-soft)' : 'var(--nebula-3)' }}>
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-medium">{item.title}</p><p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{item.body}</p></div>
              {!item.is_read && <span className="badge badge-ongoing">New</span>}
            </div>
          </button>
        ))}
        {items.length === 0 && <div className="card p-8 text-center" style={{ color: 'var(--text-muted)' }}>No notifications yet.</div>}
      </div>
    </Layout>
  )
}
