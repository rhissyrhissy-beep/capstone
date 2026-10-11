import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { subscribe } from '../lib/realtime'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import DatePicker from '../components/DatePicker'

function todayKey() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

export default function Vehicles() {
  const { profile, refreshProfile } = useAuth()
  const [vehicles, setVehicles] = useState([])
  const [blockedDates, setBlockedDates] = useState([])
  const [agreementTerms, setAgreementTerms] = useState(null)
  const [agreementAccepted, setAgreementAccepted] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [vehicleDetails, setVehicleDetails] = useState(null)
  const [booking, setBooking] = useState(null) // vehicle being booked
  const [bookingStep, setBookingStep] = useState(1)
  const [age, setAge] = useState(profile?.age ? String(profile.age) : '')
  const [form, setForm] = useState({ start_date: '', end_date: '', pickup_time: '', return_time: '', pickup_location: '', notes: '', distance_km: '', service_type: 'self_drive' })
  const [requirements, setRequirements] = useState({
    id_type: profile?.id_type ?? '',
    id_number: profile?.id_number ?? '',
    second_id_type: profile?.second_id_type ?? '',
    second_id_number: profile?.second_id_number ?? '',
    address: profile?.address ?? '',
  })
  const [requirementFiles, setRequirementFiles] = useState({ firstId: null, secondId: null, address: null, income: null, extra1: null, extra2: null })
  const [verification, setVerification] = useState({
    status: profile?.verification_status ?? 'unsubmitted',
    id_photo_path: profile?.id_photo_path,
    second_id_photo_path: profile?.second_id_photo_path,
    proof_of_address_path: profile?.proof_of_address_path,
    proof_of_income_path: profile?.proof_of_income_path,
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const [vehicleList, terms, reservations] = await Promise.all([
        api.get('/vehicles'),
        api.get('/public/rental-agreement'),
        profile ? api.get('/vehicles/unavailable-dates') : Promise.resolve([]),
      ])
      setLoadError('')
      setVehicles(vehicleList)
      setAgreementTerms(terms)
      setBlockedDates(reservations)
    } catch (vehicleError) {
      setVehicles([])
      setLoadError(`Unable to load vehicles: ${vehicleError.message}`)
    }
  }

  useEffect(() => {
    load()
    if (profile) return subscribe('bookings', load)
  }, [profile?.id])

  useEffect(() => {
    if (!profile) return
    setAge(profile.age ? String(profile.age) : '')
    setRequirements({
      id_type: profile.id_type ?? '',
      id_number: profile.id_number ?? '',
      second_id_type: profile.second_id_type ?? '',
      second_id_number: profile.second_id_number ?? '',
      address: profile.address ?? '',
    })
    setVerification({
      status: profile.verification_status ?? 'unsubmitted',
      id_photo_path: profile.id_photo_path,
      second_id_photo_path: profile.second_id_photo_path,
      proof_of_address_path: profile.proof_of_address_path,
      proof_of_income_path: profile.proof_of_income_path,
    })
  }, [profile?.id])

  function openBooking(v) {
    setBooking(v)
    setBookingStep(1)
    setAgreementAccepted(false)
    setForm({ start_date: '', end_date: '', pickup_time: '', return_time: '', pickup_location: '', notes: '', distance_km: '', service_type: 'self_drive' })
    setRequirements({
      id_type: profile?.id_type ?? '',
      id_number: profile?.id_number ?? '',
      second_id_type: profile?.second_id_type ?? '',
      second_id_number: profile?.second_id_number ?? '',
      address: profile?.address ?? '',
    })
    setRequirementFiles({ firstId: null, secondId: null, address: null, income: null, extra1: null, extra2: null })
    setError('')
  }

  function estimateDays() {
    if (!form.start_date || !form.end_date) return 0
    const [startYear, startMonth, startDay] = form.start_date.split('-').map(Number)
    const [endYear, endMonth, endDay] = form.end_date.split('-').map(Number)
    const days = (Date.UTC(endYear, endMonth - 1, endDay) - Date.UTC(startYear, startMonth - 1, startDay)) / 86400000
    return days >= 0 ? days + 1 : 0
  }

  function overlapsExistingBooking(startDate, endDate) {
    if (!booking || !startDate || !endDate) return false
    return blockedDates.some((reservation) => (
      reservation.vehicle_id === booking.id &&
      startDate <= reservation.end_date &&
      endDate >= reservation.start_date
    ))
  }

  function dateIsBlocked(date) {
    return overlapsExistingBooking(date, date)
  }

  function changeDate(field, value) {
    if (value && dateIsBlocked(value)) {
      setError('That date is unavailable because this vehicle is already rented or reserved.')
      setForm((current) => ({ ...current, [field]: '' }))
      return
    }
    setError('')
    setForm((current) => ({ ...current, [field]: value }))
  }

  function nextStep() {
    if (bookingStep === 1 && (!form.start_date || !form.end_date || estimateDays() <= 0)) {
      setError('Choose a valid start and end date before continuing.')
      return
    }
    if (bookingStep === 2 && (!form.pickup_time || !form.return_time || (form.service_type === 'pickup_dropoff' && !form.pickup_location.trim()) || form.distance_km === '')) {
      setError('Choose pickup and return times, add the required service location, and enter the destination distance.')
      return
    }
    if (bookingStep === 2 && form.start_date === form.end_date && form.return_time <= form.pickup_time) {
      setError('Return time must be after pickup time for a same-day rental.')
      return
    }
    if (bookingStep === 3 && !agreementAccepted) {
      setError('Please read and acknowledge the rental agreement before continuing to requirements.')
      return
    }
    if (bookingStep === 4 && (!age || Number(age) < 1 || Number(age) > 120)) {
      setError('Enter a valid age between 1 and 120.')
      return
    }
    if (bookingStep === 4 && verification.status !== 'verified') {
      const missingIdDetails = !requirements.id_type || !requirements.id_number || !requirements.second_id_type || !requirements.second_id_number || !requirements.address.trim()
      const missingDocuments = (!verification.id_photo_path && !requirementFiles.firstId)
        || (!verification.second_id_photo_path && !requirementFiles.secondId)
        || (!verification.proof_of_address_path && !requirementFiles.address)
        || (!verification.proof_of_income_path && !requirementFiles.income)
      if (missingIdDetails || missingDocuments) {
        setError('Add both ID details and upload the required documents before continuing.')
        return
      }
    }
    setError('')
    setBookingStep((step) => Math.min(5, step + 1))
  }

  async function submitBooking(e) {
    e.preventDefault()
    setError('')
    const days = estimateDays()
    if (days <= 0) return setError('End date must be after the start date.')
    if (overlapsExistingBooking(form.start_date, form.end_date)) {
      return setError('Those dates are unavailable because this vehicle is already rented or reserved.')
    }

    setBusy(true)
    try {
      await api.put('/me/age', { age: Number(age) })

      if (verification.status !== 'verified') {
        const payload = new FormData()
        payload.append('id_type', requirements.id_type.trim())
        payload.append('id_number', requirements.id_number.trim())
        payload.append('second_id_type', requirements.second_id_type.trim())
        payload.append('second_id_number', requirements.second_id_number.trim())
        payload.append('address', requirements.address.trim())
        if (requirementFiles.firstId) payload.append('first_id', requirementFiles.firstId)
        if (requirementFiles.secondId) payload.append('second_id', requirementFiles.secondId)
        if (requirementFiles.address) payload.append('proof_of_address', requirementFiles.address)
        if (requirementFiles.income) payload.append('proof_of_income', requirementFiles.income)
        if (requirementFiles.extra1) payload.append('extra_document_1', requirementFiles.extra1)
        if (requirementFiles.extra2) payload.append('extra_document_2', requirementFiles.extra2)
        const updated = await api.upload('/me/verification', payload)
        setVerification({
          status: updated.verification_status,
          id_photo_path: updated.id_photo_path,
          second_id_photo_path: updated.second_id_photo_path,
          proof_of_address_path: updated.proof_of_address_path,
          proof_of_income_path: updated.proof_of_income_path,
        })
      }

      await api.post('/bookings', {
        vehicle_id: booking.id,
        start_date: form.start_date,
        end_date: form.end_date,
        pickup_time: form.pickup_time,
        return_time: form.return_time,
        pickup_location: form.service_type === 'pickup_dropoff' ? form.pickup_location.trim() : null,
        notes: form.notes,
        service_type: form.service_type,
        distance_km: Number(form.distance_km || 0),
      })
      refreshProfile().catch(() => {})
      setBooking(null)
      setSuccess('Booking request and requirements sent! Track its status under "My bookings".')
      setTimeout(() => setSuccess(''), 4000)
    } catch (submitError) {
      setError(submitError.message)
    }
    setBusy(false)
  }

  const vehicleBlockedRanges = blockedDates
    .filter((reservation) => reservation.vehicle_id === booking?.id)

  return (
    <Layout>
      <h1 className="font-display text-2xl font-semibold mb-1">Available vehicles</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Pick a ride and send a booking request to Pardz Car Rental.</p>

      {success && (
        <p className="text-sm px-4 py-3 rounded-xl mb-5" style={{ background: 'rgba(74,222,128,0.12)', color: 'var(--success)' }}>{success}</p>
      )}
      {loadError && <p className="text-sm px-4 py-3 rounded-xl mb-5" role="alert" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--danger)' }}>{loadError}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {vehicles.map((v) => (
          <div key={v.id} className="card p-5 flex flex-col">
            <div
              className="h-32 rounded-xl mb-4 galaxy-bg flex items-center justify-center font-display text-lg font-semibold"
              style={{ color: 'var(--text-muted)' }}
            >
              {v.image_url ? <img src={v.image_url} alt={`${v.make} ${v.model}`} className="w-full h-full object-cover rounded-xl" /> : `${v.make} ${v.model}`}
            </div>
            <p className="font-medium">{v.make} {v.model} <span style={{ color: 'var(--text-muted)' }}>'{String(v.year).slice(-2)}</span></p>
            <p className="text-xs uppercase tracking-wide mt-0.5" style={{ color: 'var(--text-faint)' }}>{v.category}</p>
            {v.description && <p className="mt-2 mb-4 text-sm line-clamp-3" style={{ color: 'var(--text-muted)' }}>{v.description}</p>}
            <div className="mt-auto grid grid-cols-2 gap-2">
              <button onClick={() => setVehicleDetails(v)} className="btn-ghost py-2 text-sm">More details</button>
              {profile ? <button onClick={() => openBooking(v)} className="btn-primary py-2 text-sm">Book vehicle</button> : <Link to="/login" className="btn-primary py-2 text-center text-sm">Sign in to book</Link>}
            </div>
          </div>
        ))}
        {vehicles.length === 0 && (
          <div className="card p-8 text-center col-span-full" style={{ color: 'var(--text-muted)' }}>No vehicles available right now — check back soon.</div>
        )}
      </div>

      {vehicleDetails && (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/70 p-3 sm:items-center sm:p-5" onClick={() => setVehicleDetails(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="vehicle-details-title" className="card my-4 w-full max-w-2xl p-5 sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div><h2 id="vehicle-details-title" className="font-display text-xl font-semibold">{vehicleDetails.year} {vehicleDetails.make} {vehicleDetails.model}</h2><p className="mt-1 text-sm capitalize" style={{ color: 'var(--text-muted)' }}>{vehicleDetails.category}</p></div>
              <button onClick={() => setVehicleDetails(null)} className="btn-ghost p-2" aria-label="Close vehicle details"><X size={18} /></button>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="min-h-48 overflow-hidden rounded-lg" style={{ background: 'var(--bg-surface-2)' }}>{vehicleDetails.image_url ? <img src={vehicleDetails.image_url} alt={`${vehicleDetails.make} ${vehicleDetails.model}`} className="h-full min-h-48 w-full object-cover" /> : <div className="flex min-h-48 items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>Vehicle photo unavailable</div>}</div>
              <div className="grid content-start gap-3 text-sm">
                <div><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Description</p><p className="mt-1 whitespace-pre-wrap">{vehicleDetails.description || 'Contact Pardz Car Rental for vehicle details.'}</p></div>
                <div><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Plate number</p><p className="mt-1 font-medium">{vehicleDetails.plate_number}</p></div>
                <div><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Availability</p><p className="mt-1 font-medium">Available to request</p></div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setVehicleDetails(null)} className="btn-ghost px-4 py-2 text-sm">Close</button>
              {profile ? <button onClick={() => { const vehicle = vehicleDetails; setVehicleDetails(null); openBooking(vehicle) }} className="btn-primary px-4 py-2 text-sm">Book vehicle</button> : <Link to="/login" className="btn-primary px-4 py-2 text-sm">Sign in to book</Link>}
            </div>
          </section>
        </div>
      )}

      {booking && (
        <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className={`card p-4 sm:p-6 w-full ${bookingStep === 3 ? 'max-w-3xl' : 'max-w-md'} max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg">Book {booking.make} {booking.model}</h2>
              <button onClick={() => setBooking(null)} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>
            <form onSubmit={submitBooking} className="flex flex-col gap-3">
              {error && <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--danger)' }}>{error}</p>}
              <div className="grid grid-cols-5 gap-1 text-center text-[11px] sm:text-xs" style={{ color: 'var(--text-muted)' }}>
                {['Dates', 'Rental', 'Agreement', 'Requirements', 'Review'].map((label, index) => <span key={label} className="rounded px-1 py-1" style={{ color: bookingStep === index + 1 ? 'var(--nebula-3)' : undefined, background: bookingStep === index + 1 ? 'var(--bg-surface-2)' : undefined }}>{index + 1}. {label}</span>)}
              </div>
              {bookingStep === 1 && <>
                <DatePicker label="Start date" value={form.start_date} minDate={todayKey()} blockedRanges={vehicleBlockedRanges} onChange={(value) => changeDate('start_date', value)} />
                <DatePicker label="End date" value={form.end_date} minDate={form.start_date || todayKey()} blockedRanges={vehicleBlockedRanges} onChange={(value) => changeDate('end_date', value)} />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Only accepted or ongoing bookings block dates for this vehicle. Pending requests do not reserve it yet.</p>
                <button type="button" onClick={nextStep} disabled={overlapsExistingBooking(form.start_date, form.end_date)} className="btn-primary py-2.5 mt-2">Next: rental details</button>
              </>}
              {bookingStep === 2 && <>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-sm">Pickup time<input required type="time" className="px-3 py-2" value={form.pickup_time} onChange={(e) => setForm({ ...form, pickup_time: e.target.value })} /></label>
                  <label className="flex flex-col gap-1 text-sm">Return time<input required type="time" className="px-3 py-2" value={form.return_time} onChange={(e) => setForm({ ...form, return_time: e.target.value })} /></label>
                </div>
                <label className="flex flex-col gap-1 text-sm">Service type<select value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value, pickup_location: e.target.value === 'pickup_dropoff' ? form.pickup_location : '' })} className="px-3 py-2"><option value="self_drive">Self-drive</option><option value="with_driver">With driver</option><option value="pickup_dropoff">Pickup / drop-off service</option></select></label>
                {form.service_type === 'pickup_dropoff' && <label className="flex flex-col gap-1 text-sm">Where should we pick up / drop off the car?<input required className="px-3 py-2" placeholder="e.g. Cagayan de Oro airport" value={form.pickup_location} onChange={(e) => setForm({ ...form, pickup_location: e.target.value })} /></label>}
                <label className="flex flex-col gap-1 text-sm">Distance to destination (km)<input required min="0" type="number" step="0.1" className="px-3 py-2" value={form.distance_km} onChange={(e) => setForm({ ...form, distance_km: e.target.value })} placeholder="e.g. 25" /></label>
                <div className="flex gap-2"><button type="button" onClick={() => setBookingStep(1)} className="btn-ghost py-2.5 flex-1">Back</button><button type="button" onClick={nextStep} className="btn-primary py-2.5 flex-1">Review agreement</button></div>
              </>}
              {bookingStep === 3 && <>
                <section className="rounded-lg border p-4 sm:p-5" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-surface-2)' }}>
                  <h3 className="text-center font-display text-lg font-semibold">{agreementTerms?.title || 'Rental Agreement'}</h3>
                  <p className="mt-3 text-xs font-semibold">{agreementTerms?.preamble}</p>
                  <p className="mt-2 text-sm leading-relaxed">This agreement is between <strong>{profile?.full_name}</strong>, resident of <strong>{profile?.address || 'address to be entered in requirements'}</strong> and holder of the customer's submitted ID, hereunder called the RENTER, and PARDZ CAR RENTAL, hereunder called the LESSOR.</p>
                  <h4 className="mt-4 text-center text-sm font-semibold">{agreementTerms?.witnesseth}</h4>
                  <p className="mt-1 text-sm">{agreementTerms?.vehicle_details_intro}</p>
                  <dl className="mt-3 grid gap-x-5 gap-y-2 text-sm sm:grid-cols-2">
                    <div><dt className="text-xs" style={{ color: 'var(--text-muted)' }}>Vehicle</dt><dd className="font-medium">{booking.year} {booking.make} {booking.model}</dd></div>
                    <div><dt className="text-xs" style={{ color: 'var(--text-muted)' }}>Period</dt><dd className="font-medium">{form.start_date} to {form.end_date} · {estimateDays()} day(s)</dd></div>
                    <div><dt className="text-xs" style={{ color: 'var(--text-muted)' }}>Release</dt><dd className="font-medium">{form.start_date} {form.pickup_time}</dd></div>
                    <div><dt className="text-xs" style={{ color: 'var(--text-muted)' }}>Return</dt><dd className="font-medium">{form.end_date} {form.return_time}</dd></div>
                    <div><dt className="text-xs" style={{ color: 'var(--text-muted)' }}>Service</dt><dd className="font-medium capitalize">{form.service_type.replaceAll('_', ' ')}</dd></div>
                    {form.pickup_location && <div><dt className="text-xs" style={{ color: 'var(--text-muted)' }}>Pickup / drop-off</dt><dd className="font-medium">{form.pickup_location}</dd></div>}
                  </dl>
                  <h4 className="mt-4 text-sm font-semibold">The Renter agrees:</h4>
                  <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
                    {(agreementTerms?.renter_terms || []).map((term, index) => <li key={index}>{term.replace('{period}', `${form.start_date} to ${form.end_date} (${estimateDays()} day(s))`).replace('{amount}', 'the agreed rental amount')}</li>)}
                  </ol>
                  <h4 className="mt-4 text-center text-sm font-semibold">{agreementTerms?.liability_heading}</h4>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{agreementTerms?.liability_text}</p>
                  <p className="mt-4 text-sm">Signatures will be collected on the printed agreement.</p>
                </section>
                <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={agreementAccepted} onChange={(event) => setAgreementAccepted(event.target.checked)} className="mt-1" /><span>I have read the rental agreement and want to continue to the customer requirements.</span></label>
                <div className="flex gap-2"><button type="button" onClick={() => setBookingStep(2)} className="btn-ghost py-2.5 flex-1">Back</button><button type="button" onClick={nextStep} className="btn-primary py-2.5 flex-1">Continue to requirements</button></div>
              </>}
              {bookingStep === 4 && <>
                <label className="flex flex-col gap-1 text-sm">Age<input required type="number" min="1" max="120" step="1" value={age} onChange={(e) => setAge(e.target.value)} className="px-3 py-2" placeholder="Enter your age" /></label>
                {verification.status === 'verified' ? (
                  <p className="text-sm" style={{ color: 'var(--success)' }}>Your customer documents are verified. No additional requirements are needed.</p>
                ) : <>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Submit two valid government-issued IDs, proof of address, and proof of income with your booking request.</p>
                  {profile?.verification_notes && <p className="rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--danger)' }}>Admin note: {profile.verification_notes}</p>}
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 text-sm">Primary ID type<select required value={requirements.id_type} onChange={(e) => setRequirements({ ...requirements, id_type: e.target.value })} className="px-3 py-2"><option value="">Select ID type</option><option>Driver's License</option><option>Passport</option><option>National ID</option><option>Other government-issued ID</option></select></label>
                    <label className="flex flex-col gap-1 text-sm">Primary ID number<input required value={requirements.id_number} onChange={(e) => setRequirements({ ...requirements, id_number: e.target.value })} className="px-3 py-2" /></label>
                    <label className="flex flex-col gap-1 text-sm">Primary ID photo<input required={!verification.id_photo_path} type="file" accept="image/*" onChange={(e) => setRequirementFiles({ ...requirementFiles, firstId: e.target.files?.[0] ?? null })} className="px-3 py-2" /></label>
                    <label className="flex flex-col gap-1 text-sm">Second ID type<select required value={requirements.second_id_type} onChange={(e) => setRequirements({ ...requirements, second_id_type: e.target.value })} className="px-3 py-2"><option value="">Select ID type</option><option>Driver's License</option><option>Passport</option><option>National ID</option><option>Other government-issued ID</option></select></label>
                    <label className="flex flex-col gap-1 text-sm">Second ID number<input required value={requirements.second_id_number} onChange={(e) => setRequirements({ ...requirements, second_id_number: e.target.value })} className="px-3 py-2" /></label>
                    <label className="flex flex-col gap-1 text-sm">Second ID photo<input required={!verification.second_id_photo_path} type="file" accept="image/*" onChange={(e) => setRequirementFiles({ ...requirementFiles, secondId: e.target.files?.[0] ?? null })} className="px-3 py-2" /></label>
                    <label className="flex flex-col gap-1 text-sm">Proof of address<input required={!verification.proof_of_address_path} type="file" accept="image/*,.pdf" onChange={(e) => setRequirementFiles({ ...requirementFiles, address: e.target.files?.[0] ?? null })} className="px-3 py-2" /></label>
                    <label className="flex flex-col gap-1 text-sm">Proof of income<input required={!verification.proof_of_income_path} type="file" accept="image/*,.pdf" onChange={(e) => setRequirementFiles({ ...requirementFiles, income: e.target.files?.[0] ?? null })} className="px-3 py-2" /></label>
                    <label className="flex flex-col gap-1 text-sm sm:col-span-2">Home / mailing address<input required maxLength={500} value={requirements.address} onChange={(e) => setRequirements({ ...requirements, address: e.target.value })} className="px-3 py-2" /></label>
                    <label className="flex flex-col gap-1 text-sm">Additional requirement photo 1 (optional)<input type="file" accept="image/*" onChange={(e) => setRequirementFiles({ ...requirementFiles, extra1: e.target.files?.[0] ?? null })} className="px-3 py-2" /></label>
                    <label className="flex flex-col gap-1 text-sm">Additional requirement photo 2 (optional)<input type="file" accept="image/*" onChange={(e) => setRequirementFiles({ ...requirementFiles, extra2: e.target.files?.[0] ?? null })} className="px-3 py-2" /></label>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Current verification status: {verification.status}</p>
                </>}
                <div className="flex gap-2"><button type="button" onClick={() => setBookingStep(3)} className="btn-ghost py-2.5 flex-1">Back to agreement</button><button type="button" onClick={nextStep} className="btn-primary py-2.5 flex-1">Next: review</button></div>
              </>}
              {bookingStep === 5 && <>
                <label className="flex flex-col gap-1 text-sm">Notes (optional)<textarea rows={3} className="px-3 py-2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
                <div className="card p-3 text-sm" style={{ background: 'var(--bg-surface-2)' }}><p><strong>{booking.make} {booking.model}</strong></p><p style={{ color: 'var(--text-muted)' }}>{form.start_date} {form.pickup_time} → {form.end_date} {form.return_time} · {form.service_type.replaceAll('_', ' ')}</p>{form.service_type === 'pickup_dropoff' && <p style={{ color: 'var(--text-muted)' }}>Pickup / drop-off: {form.pickup_location}</p>}<p style={{ color: 'var(--text-muted)' }}>{form.distance_km} km · {estimateDays()} rental day(s)</p></div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Customer requirements: {verification.status === 'verified' ? 'Already verified' : 'Submitted for review with this booking'}</p>
                <div className="flex gap-2"><button type="button" onClick={() => setBookingStep(4)} className="btn-ghost py-2.5 flex-1">Back</button><button type="submit" disabled={busy || overlapsExistingBooking(form.start_date, form.end_date)} className="btn-primary py-2.5 flex-1">{busy ? 'Sending…' : 'Send booking request'}</button></div>
              </>}
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
