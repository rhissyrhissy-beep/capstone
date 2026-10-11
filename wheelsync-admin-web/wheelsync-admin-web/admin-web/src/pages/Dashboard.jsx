import { useEffect, useState } from 'react'
import { CalendarClock, Car, Users, TrendingUp } from 'lucide-react'
import { api } from '../lib/api'
import { subscribe } from '../lib/realtime'
import Layout from '../components/Layout'
import StatCard from '../components/StatCard'
import Badge from '../components/Badge'

export default function Dashboard() {
  const [stats, setStats] = useState({ pending: 0, vehicles: 0, customers: 0, revenue: 0 })
  const [recent, setRecent] = useState([])
  const [monthlyRentals, setMonthlyRentals] = useState([])
  const [statsError, setStatsError] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    setStatsError('')
    try {
      const data = await api.get('/admin/dashboard', { year: new Date().getFullYear() })
      setStats({ pending: data.pending, vehicles: data.vehicles, customers: data.customers, revenue: data.revenue })
      setRecent(data.recent ?? [])
      setMonthlyRentals(data.monthly_rentals.map(({ month, count }) => ({
        month: new Date(data.year, month - 1, 1).toLocaleDateString(undefined, { month: 'short' }),
        count,
      })))
    } catch (error) {
      setStatsError(error.message || 'Unable to load dashboard statistics.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    return subscribe('bookings', load)
  }, [])

  const busiestMonth = monthlyRentals.reduce((busiest, month) => month.count > busiest.count ? month : busiest, { month: 'No rentals yet', count: 0 })

  return (
    <Layout>
      <h1 className="font-display text-2xl font-semibold mb-1">Dashboard</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        Live overview of Pardz Car Rental bookings and fleet.
      </p>
      {statsError && <p role="alert" className="text-sm px-4 py-3 rounded-xl mb-5" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--danger)' }}>{statsError}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Pending requests" value={stats.pending} icon={CalendarClock} />
        <StatCard label="Fleet size" value={stats.vehicles} icon={Car} />
        <StatCard label="Registered customers" value={stats.customers} icon={Users} />
        <StatCard label="Completed revenue" value={`₱${stats.revenue.toLocaleString()}`} icon={TrendingUp} />
      </div>

      <section className="card p-5 mb-8">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div>
            <h2 className="font-display font-semibold">Rentals by month</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Accepted, ongoing, and completed bookings by scheduled start month this year. Pending requests are excluded.</p>
          </div>
          <p className="text-sm">{busiestMonth.count ? <>Most rentals: <strong>{busiestMonth.month}</strong> · {busiestMonth.count}</> : 'No rentals are scheduled or active this year.'}</p>
        </div>
        <div className="grid grid-cols-[2.5rem_1fr_2rem] gap-3 mb-2 text-xs" style={{ color: 'var(--text-faint)' }}><span /><span></span><span className="text-right">Count</span></div>
        <div className="grid gap-2">
          {monthlyRentals.map((month) => (
            <div key={month.month} className="grid grid-cols-[2.5rem_1fr_2rem] items-center gap-3 text-sm">
              <span style={{ color: 'var(--text-muted)' }}>{month.month}</span>
              <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface-2)' }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, month.count * 5)}%`, background: 'var(--gradient-primary)' }} />
              </div>
              <span className="text-right font-medium" aria-label={`${month.count} rentals`}>{month.count}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="card p-5">
        <h2 className="font-display font-semibold mb-4">Recent bookings</h2>
        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
        ) : recent.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No bookings yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
                  <th className="py-2 pr-4 font-medium">Customer</th>
                  <th className="py-2 pr-4 font-medium">Vehicle</th>
                  <th className="py-2 pr-4 font-medium">Dates</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((b) => (
                  <tr key={b.id} style={{ borderTop: '1px solid var(--border-soft)' }}>
                    <td className="py-2.5 pr-4">{b.profiles?.full_name ?? '—'}</td>
                    <td className="py-2.5 pr-4">{b.vehicles ? `${b.vehicles.make} ${b.vehicles.model}` : '—'}</td>
                    <td className="py-2.5 pr-4">{b.start_date} {b.pickup_time?.slice(0, 5) || ''} → {b.end_date} {b.return_time?.slice(0, 5) || ''}</td>
                    <td className="py-2.5 pr-4"><Badge status={b.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}
