import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, CalendarCheck, Car, CarFront, Users, UserCog, UserRoundX, Bell, FileBarChart, LogOut, Menu, X, RefreshCw, Settings, ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import ThemeToggle from './ThemeToggle'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/bookings', label: 'Bookings', icon: CalendarCheck },
  { to: '/vehicles', label: 'Vehicles', icon: Car },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/blacklist', label: 'Blacklist', icon: UserRoundX },
  { to: '/staff', label: 'Staff', icon: UserCog },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
]

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [now, setNow] = useState(new Date())
  const [unreadNotifications, setUnreadNotifications] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!profile?.id) {
      setUnreadNotifications(0)
      return
    }

    let active = true
    async function loadUnreadNotifications() {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('is_read', false)
      if (error) {
        console.error('Unable to load unread notification count:', error.message)
        return
      }
      if (active) setUnreadNotifications(count ?? 0)
    }

    loadUnreadNotifications()
    const channel = supabase
      .channel(`admin-notification-count-${profile.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      }, loadUnreadNotifications)
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [profile?.id])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="h-screen flex overflow-hidden app-shell">
      <aside
        className="w-64 shrink-0 hidden md:flex flex-col justify-between p-5 galaxy-bg h-full"
        style={{ borderRight: '1px solid var(--border-soft)' }}
      >
        <div>
          <div className="flex items-center gap-2 mb-8">
            <div className="pardz-logo w-9 h-9 rounded-lg flex items-center justify-center text-white" aria-label="Pardz Car Rental"><CarFront size={20} /></div>
            <div>
              <p className="font-display font-semibold leading-none">WheelSync</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Admin Console</p>
            </div>
          </div>
          <nav className="flex flex-col gap-1">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive ? 'text-white' : ''
                  }`
                }
                style={({ isActive }) => ({
                  background: isActive ? 'var(--gradient-primary)' : 'transparent',
                  color: isActive ? 'white' : 'var(--text-muted)',
                })}
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div>
          <div className="flex items-center gap-3 px-1 mb-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-white"
              style={{ background: 'var(--gradient-primary)' }}
            >
              {profile?.full_name?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{profile?.full_name}</p>
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{profile?.email}</p>
            </div>
          </div>
          <button onClick={handleSignOut} className="btn-ghost w-full flex items-center justify-center gap-2 py-2 text-sm">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header
          className="flex items-center justify-between px-6 py-4 md:hidden"
          style={{ borderBottom: '1px solid var(--border-soft)' }}
        >
          <p className="font-display font-semibold">WheelSync Admin</p>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={() => setMenuOpen((open) => !open)} className="btn-ghost p-2" aria-label="Open navigation menu" aria-expanded={menuOpen}>
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </header>
        {menuOpen && (
          <nav className="md:hidden flex flex-col gap-1 p-4" style={{ borderBottom: '1px solid var(--border-soft)' }}>
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium" style={({ isActive }) => ({ background: isActive ? 'var(--gradient-primary)' : 'var(--bg-surface-2)', color: isActive ? 'white' : 'var(--text-muted)' })}>
                <Icon size={18} />{label}
              </NavLink>
            ))}
            <button onClick={handleSignOut} className="btn-ghost flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-left">
              <LogOut size={18} />Sign out
            </button>
          </nav>
        )}
        <header
          className="admin-topbar hidden md:flex items-center justify-end px-6 py-3"
          style={{ borderBottom: '1px solid var(--border-soft)' }}
        >
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-sm font-semibold">{now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{now.toLocaleTimeString()}</p>
            </div>
            <button onClick={() => window.location.reload()} className="btn-ghost p-2.5" aria-label="Refresh dashboard" title="Refresh dashboard"><RefreshCw size={16} /></button>
            <NavLink
              to="/notifications"
              className="btn-ghost p-2.5 relative"
              aria-label={unreadNotifications ? `Open notifications, ${unreadNotifications} unread` : 'Open notifications'}
              title={unreadNotifications ? `${unreadNotifications} unread notifications` : 'Notifications'}
            >
              <Bell size={16} />
              {unreadNotifications > 0 && (
                <span aria-hidden="true" className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: 'var(--danger)' }}>
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              )}
            </NavLink>
            <ThemeToggle />
            <div className="relative">
              <button onClick={() => setProfileMenuOpen((open) => !open)} className="flex items-center gap-2 rounded-xl px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-soft)' }} aria-label="Open account menu" aria-expanded={profileMenuOpen}>
                <div className="pardz-logo w-8 h-8 rounded-lg flex items-center justify-center text-white font-semibold">{profile?.full_name?.[0]?.toUpperCase() ?? 'A'}</div>
                <div className="leading-tight text-left"><p className="text-sm font-semibold">{profile?.full_name?.split(' ')[0] ?? 'Admin'}</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Admin</p></div>
                <ChevronDown size={15} />
              </button>
              {profileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 card p-2 z-50 shadow-xl">
                  <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-soft)' }}>
                    <p className="font-semibold">{profile?.full_name ?? 'Admin'}</p>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{profile?.email}</p>
                  </div>
                  <button onClick={() => { setProfileMenuOpen(false); navigate('/settings') }} className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm btn-ghost mt-2"><Settings size={16} /> Settings</button>
                  <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm" style={{ color: 'var(--danger)' }}><LogOut size={16} /> Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
