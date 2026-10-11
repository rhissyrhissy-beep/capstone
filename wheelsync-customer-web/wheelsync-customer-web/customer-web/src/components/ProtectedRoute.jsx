import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center galaxy-bg">
        <p style={{ color: 'var(--text-muted)' }}>Loading WheelSync…</p>
      </div>
    )
  }

  if (!session || !profile || profile.role !== 'customer' || profile.is_blacklisted) {
    return <Navigate to="/login" replace />
  }

  return children
}
