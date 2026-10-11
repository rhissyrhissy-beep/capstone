import { useMemo, useState } from 'react'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function DatePicker({ label, value, minDate, blockedRanges, onChange }) {
  const [month, setMonth] = useState(() => {
    const initial = value ? new Date(`${value}T00:00:00`) : new Date()
    return new Date(initial.getFullYear(), initial.getMonth(), 1)
  })
  const todayKey = toDateKey(new Date())
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay()
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const days = useMemo(() => Array.from({ length: firstDay + daysInMonth }, (_, index) => {
    if (index < firstDay) return null
    return new Date(month.getFullYear(), month.getMonth(), index - firstDay + 1)
  }), [firstDay, daysInMonth, month])

  function isBlocked(date) {
    const key = toDateKey(date)
    return key < (minDate || todayKey) || blockedRanges.some((range) => key >= range.start_date && key <= range.end_date)
  }

  function isPast(date) {
    return toDateKey(date) < (minDate || todayKey)
  }

  function isReserved(date) {
    const key = toDateKey(date)
    return blockedRanges.some((range) => key >= range.start_date && key <= range.end_date)
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm">{label}</span>
      <div className="card p-2 sm:p-3">
        <div className="flex items-center justify-between mb-2">
          <button type="button" className="btn-ghost px-2 py-1 text-sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month">&lt;</button>
          <strong className="text-sm">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
          <button type="button" className="btn-ghost px-2 py-1 text-sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month">&gt;</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
          {DAY_NAMES.map((day) => <span key={day} className="py-1">{day}</span>)}
          {days.map((date, index) => date ? (
            <button
              key={toDateKey(date)}
              type="button"
              disabled={isBlocked(date)}
              onClick={() => onChange(toDateKey(date))}
              className="py-1.5 sm:py-2 rounded-md text-xs sm:text-sm disabled:cursor-not-allowed disabled:opacity-25"
              style={{
                background: value === toDateKey(date) ? 'var(--gradient-primary)' : 'var(--bg-surface-2)',
                color: value === toDateKey(date) ? 'white' : 'var(--text-primary)',
              }}
              title={isPast(date) ? 'Past date' : isReserved(date) ? 'Already reserved for this vehicle' : 'Available date'}
            >
              {date.getDate()}
            </button>
          ) : <span key={`empty-${index}`} />)}
        </div>
      </div>
      <input type="hidden" required value={value} readOnly />
    </div>
  )
}
