const DAY_MS = 86400000

function daysBetween(start, end) {
  return Math.max(0, Math.round((new Date(end) - new Date(start)) / DAY_MS))
}

export function buildChurnFeatures(customerId, bookings, today = new Date()) {
  const completed = bookings
    .filter((booking) => booking.customer_id === customerId && booking.status === 'completed')
    .sort((left, right) => new Date(left.start_date) - new Date(right.start_date))

  if (completed.length === 0) return null

  const firstRentalDate = completed[0].start_date
  const lastRental = completed[completed.length - 1]
  const lastRentalDate = lastRental.actual_return_date || lastRental.end_date
  const intervals = completed.slice(1).map((booking, index) => (
    daysBetween(completed[index].start_date, booking.start_date)
  ))
  const preferredService = completed.reduce((counts, booking) => {
    const service = booking.service_type || 'self_drive'
    counts[service] = (counts[service] || 0) + 1
    return counts
  }, {})

  return {
    days_since_last_rental: daysBetween(lastRentalDate, today),
    total_rentals_completed: completed.length,
    avg_days_between_rentals: intervals.length
      ? Math.round(intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length)
      : 0,
    late_return_rate: completed.filter((booking) => booking.late_return).length / completed.length,
    preferred_service_type: Object.entries(preferredService).sort((left, right) => right[1] - left[1])[0][0],
    customer_tenure_days: daysBetween(firstRentalDate, today),
    total_amount_spent: completed.reduce((sum, booking) => sum + Number(booking.total_amount || 0), 0),
  }
}

export function predictChurn(features) {
  if (!features || features.total_rentals_completed < 2) {
    return { label: 'New Customer - Not Yet Rated', probability: null }
  }

  const normalGap = Math.max(features.avg_days_between_rentals, 30)
  const overdueRatio = Math.max(0, features.days_since_last_rental - normalGap) / normalGap
  const probability = Math.min(0.95, Math.max(0.05, 0.2 + overdueRatio * 0.55 + features.late_return_rate * 0.25 - Math.min(features.total_rentals_completed, 10) * 0.015))

  return {
    label: probability >= 0.5 ? 'At Risk of Churn' : 'Likely to Return',
    probability,
  }
}
