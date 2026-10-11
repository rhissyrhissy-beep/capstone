import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

export default function Blacklist() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, created_at')
      .eq('role', 'customer')
      .eq('is_blacklisted', true)
      .order('created_at', { ascending: false })
    setCustomers(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function removeFromBlacklist(id) {
    await supabase.from('profiles').update({ is_blacklisted: false }).eq('id', id)
    load()
  }

  return (
    <Layout>
      <h1 className="font-display text-2xl font-semibold mb-1">Blacklist</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        Customers on this list cannot log in or access the customer booking site.
      </p>
      {loading ? <p style={{ color: 'var(--text-muted)' }}>Loading...</p> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left" style={{ color: 'var(--text-muted)' }}>
              <th className="py-3 px-5 font-medium">Name</th>
              <th className="py-3 px-5 font-medium">Email</th>
              <th className="py-3 px-5 font-medium">Phone</th>
              <th className="py-3 px-5 font-medium">Action</th>
            </tr></thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} style={{ borderTop: '1px solid var(--border-soft)' }}>
                  <td className="py-3 px-5">{customer.full_name}</td>
                  <td className="py-3 px-5">{customer.email}</td>
                  <td className="py-3 px-5">{customer.phone || '-'}</td>
                  <td className="py-3 px-5 text-right"><button onClick={() => removeFromBlacklist(customer.id)} className="btn-ghost px-3 py-1.5 text-xs">Remove</button></td>
                </tr>
              ))}
              {customers.length === 0 && <tr><td colSpan={4} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>No blacklisted customers.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}