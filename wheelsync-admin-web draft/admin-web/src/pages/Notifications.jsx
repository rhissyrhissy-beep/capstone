import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

export default function Notifications() {
  const [items, setItems] = useState([])

  async function load() {
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false })
    setItems(data ?? [])
  }

  useEffect(() => {
    load()
    const channel = supabase.channel('admin-notifications').on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, load).subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function markRead(id) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
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
