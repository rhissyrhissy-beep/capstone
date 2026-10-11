export default function Badge({ status }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1)
  return <span className={`badge badge-${status}`}>{label}</span>
}
