export default function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="card p-5 flex items-center justify-between">
      <div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <p className="text-3xl font-display font-semibold mt-1">{value}</p>
      </div>
      {Icon && (
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--gradient-primary)' }}
        >
          <Icon size={20} color="white" />
        </div>
      )}
    </div>
  )
}
