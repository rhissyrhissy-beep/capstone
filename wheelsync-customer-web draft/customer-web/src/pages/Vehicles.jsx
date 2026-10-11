import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import DatePicker from '../components/DatePicker'

function todayKey() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

export default function Vehicles() {
  const { profile } = useAuth()
  const [vehicles, setVehicles] = useState([])
  const [blockedDates, setBlockedDates] = useState([])
  const [loadError, setLoadError] = useState('')
  const [booking, setBooking] = useState(null) // vehicle being booked
  const [bookingStep, setBookingStep] = useState(1)
  const [age, setAge] = useState(profile?.age ? String(profile.age) : '')
  const [form, setForm] = useState({ start_date: '', end_date: '', pickup_time: '', return_time: '', pickup_location: '', notes: '', distance_km: '', service_type: 'self_drive' })
  const [requirements, setRequirements] = useState({
    id_type: profile?.id_type ?? '',
    id_number: profile?.id_number ?? '',
    second_id_type: profile?.second_id_type ?? '',
    second_id_number: profile?.second_id_number ?? '',
  })
  const [requirementFiles, setRequirementFiles] = useState({ firstId: null, secondId: null, address: null, income: null })
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
    const [{ data, error: vehicleError }, { data: reservations }] = await Promise.all([
      supabase.from('customer_vehicles').select('id, make, model, year, category, image_url, status').order('make'),
      supabase.rpc('get_vehicle_unavailable_dates'),
    ])
    if (vehicleError) {
      setVehicles([])
      setLoadError(`Unable to load vehicles: ${vehicleError.message}`)
      return
    }
    setLoadError('')
    setVehicles(data ?? [])
    setBlockedDates(reservations ?? [])
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel('vehicle-availability')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  function openBooking(v) {
    setBooking(v)
    setBookingStep(1)
    setForm({ start_date: '', end_date: '', pickup_time: '', return_time: '', pickup_location: '', notes: '', distance_km: '', service_type: 'self_drive' })
    setRequirements({
      id_type: profile?.id_type ?? '',
      id_number: profile?.id_number ?? '',
      second_id_type: profile?.second_id_type ?? '',
      second_id_number: profile?.second_id_number ?? '',
    })
    setRequirementFiles({ firstId: null, secondId: null, address: null, income: null })
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
    if (bookingStep === 3 && (!age || Number(age) < 1 || Number(age) > 120)) {
      setError('Enter a valid age between 1 and 120.')
      return
    }
    if (bookingStep === 3 && verification.status !== 'verified') {
      const missingIdDetails = !requirements.id_type || !requirements.id_number || !requirements.second_id_type || !requirements.second_id_number
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
    setBookingStep((step) => Math.min(4, step + 1))
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
      const { error: ageError } = await supabase.rpc('set_customer_age', { requested_age: Number(age) })
      if (ageError) throw ageError

      if (verification.status !== 'verified') {
        async function uploadFile(file) {
          if (!file) return null
          const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
          const path = `${profile.id}/${crypto.randomUUID()}.${extension}`
          const { error: uploadError } = await supabase.storage.from('customer-documents').upload(path, file, { upsert: false })
          if (uploadError) throw uploadError
          return path
        }

        const [idPhotoPath, secondIdPhotoPath, addressPath, incomePath] = await Promise.all([
          uploadFile(requirementFiles.firstId),
          uploadFile(requirementFiles.secondId),
          uploadFile(requirementFiles.address),
          uploadFile(requirementFiles.income),
        ])
        const { error: profileError } = await supabase.from('profiles').update({
          id_type: requirements.id_type.trim(),
          id_number: requirements.id_number.trim(),
          id_photo_path: idPhotoPath || profile?.id_photo_path,
          second_id_type: requirements.second_id_type.trim(),
          second_id_number: requirements.second_id_number.trim(),
          second_id_photo_path: secondIdPhotoPath || profile?.second_id_photo_path,
          proof_of_address_path: addressPath || profile?.proof_of_address_path,
          proof_of_income_path: incomePath || profile?.proof_of_income_path,
          verification_status: 'pending',
          verification_notes: null,
        }).eq('id', profile.id)
        if (profileError) throw profileError
        setVerification({
          status: 'pending',
          id_photo_path: idPhotoPath || verification.id_photo_path,
          second_id_photo_path: secondIdPhotoPath || verification.second_id_photo_path,
          proof_of_address_path: addressPath || verification.proof_of_address_path,
          proof_of_income_path: incomePath || verification.proof_of_income_path,
        })
      }

      const { error: bookingError } = await supabase.from('bookings').insert({
        customer_id: profile.id,
        vehicle_id: booking.id,
        start_date: form.start_date,
        end_date: form.end_date,
        pickup_time: form.pickup_time,
        return_time: form.return_time,
        pickup_location: form.service_type === 'pickup_dropoff' ? form.pickup_location.trim() : null,
        notes: form.notes,
        service_type: form.service_type,
        distance_km: Number(form.distance_km || 0),
        status: 'pending',
      })
      if (bookingError) throw bookingError
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
            <button onClick={() => openBooking(v)} className="btn-primary py-2 text-sm mt-auto">Book this vehicle</button>
          </div>
        ))}
        {vehicles.length === 0 && (
          <div className="card p-8 text-center col-span-full" style={{ color: 'var(--text-muted)' }}>No vehicles available right now — check back soon.</div>
        )}
      </div>

      {booking && (
        <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="card p-4 sm:p-6 w-full max-w-md max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg">Book {booking.make} {booking.model}</h2>
              <button onClick={() => setBooking(null)} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>
            <form onSubmit={submitBooking} className="flex flex-col gap-3">
              {error && <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--danger)' }}>{error}</p>}
              <div className="flex items-center gap-2 text-xs mb-1" style={{ color: 'var(--text-muted)' }}><span style={{ color: bookingStep >= 1 ? 'var(--nebula-3)' : undefined }}>1. Dates</span><span>→</span><span style={{ color: bookingStep >= 2 ? 'var(--nebula-3)' : undefined }}>2. Rental details</span><span>→</span><span style={{ color: bookingStep >= 3 ? 'var(--nebula-3)' : undefined }}>3. Requirements</span><span>→</span><span style={{ color: bookingStep >= 4 ? 'var(--nebula-3)' : undefined }}>4. Review</span></div>
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
                <div className="flex gap-2"><button type="button" onClick={() => setBookingStep(1)} className="btn-ghost py-2.5 flex-1">Back</button><button type="button" onClick={nextStep} className="btn-primary py-2.5 flex-1">Next: requirements</button></div>
              </>}
              {bookingStep === 3 && <>
                <label className="flex flex-col gap-1 text-sm">Age<input required type="number" min="1" max="120" step="1" value={age} onChange={(e) => setAge(e.target.value)} className="px-3 py-2" placeholder="Enter your age" /></label>
                {verification.status === 'verified' ? (
                  <p className="text-sm" style={{ color: 'var(--success)' }}>Your customer documents are verified. No additional requirements are needed.</p>
                ) : <>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Submit two valid government-issued IDs, proof of address, and proof of income with your booking request.</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 text-sm">Primary ID type<select required value={requirements.id_type} onChange={(e) => setRequirements({ ...requirements, id_type: e.target.value })} className="px-3 py-2"><option value="">Select ID type</option><option>Driver's License</option><option>Passport</option><option>National ID</option><option>Other government-issued ID</option></select></label>
                    <label className="flex flex-col gap-1 text-sm">Primary ID number<input required value={requirements.id_number} onChange={(e) => setRequirements({ ...requirements, id_number: e.target.value })} className="px-3 py-2" /></label>
                    <label className="flex flex-col gap-1 text-sm">Primary ID photo<input required={!verification.id_photo_path} type="file" accept="image/*" onChange={(e) => setRequirementFiles({ ...requirementFiles, firstId: e.target.files?.[0] ?? null })} className="px-3 py-2" /></label>
                    <label className="flex flex-col gap-1 text-sm">Second ID type<select required value={requirements.second_id_type} onChange={(e) => setRequirements({ ...requirements, second_id_type: e.target.value })} className="px-3 py-2"><option value="">Select ID type</option><option>Driver's License</option><option>Passport</option><option>National ID</option><option>Other government-issued ID</option></select></label>
                    <label className="flex flex-col gap-1 text-sm">Second ID number<input required value={requirements.second_id_number} onChange={(e) => setRequirements({ ...requirements, second_id_number: e.target.value })} className="px-3 py-2" /></label>
                    <label className="flex flex-col gap-1 text-sm">Second ID photo<input required={!verification.second_id_photo_path} type="file" accept="image/*" onChange={(e) => setRequirementFiles({ ...requirementFiles, secondId: e.target.files?.[0] ?? null })} className="px-3 py-2" /></label>
                    <label className="flex flex-col gap-1 text-sm">Proof of address<input required={!verification.proof_of_address_path} type="file" accept="image/*,.pdf" onChange={(e) => setRequirementFiles({ ...requirementFiles, address: e.target.files?.[0] ?? null })} className="px-3 py-2" /></label>
                    <label className="flex flex-col gap-1 text-sm">Proof of income<input required={!verification.proof_of_income_path} type="file" accept="image/*,.pdf" onChange={(e) => setRequirementFiles({ ...requirementFiles, income: e.target.files?.[0] ?? null })} className="px-3 py-2" /></label>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Current verification status: {verification.status}</p>
                </>}
                <div className="flex gap-2"><button type="button" onClick={() => setBookingStep(2)} className="btn-ghost py-2.5 flex-1">Back</button><button type="button" onClick={nextStep} className="btn-primary py-2.5 flex-1">Next: review</button></div>
              </>}
              {bookingStep === 4 && <>
                <label className="flex flex-col gap-1 text-sm">Notes (optional)<textarea rows={3} className="px-3 py-2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
                <div className="card p-3 text-sm" style={{ background: 'var(--bg-surface-2)' }}><p><strong>{booking.make} {booking.model}</strong></p><p style={{ color: 'var(--text-muted)' }}>{form.start_date} {form.pickup_time} → {form.end_date} {form.return_time} · {form.service_type.replaceAll('_', ' ')}</p>{form.service_type === 'pickup_dropoff' && <p style={{ color: 'var(--text-muted)' }}>Pickup / drop-off: {form.pickup_location}</p>}<p style={{ color: 'var(--text-muted)' }}>{form.distance_km} km · {estimateDays()} rental day(s)</p></div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Customer requirements: {verification.status === 'verified' ? 'Already verified' : 'Submitted for review with this booking'}</p>
                <div className="flex gap-2"><button type="button" onClick={() => setBookingStep(3)} className="btn-ghost py-2.5 flex-1">Back</button><button type="submit" disabled={busy || overlapsExistingBooking(form.start_date, form.end_date)} className="btn-primary py-2.5 flex-1">{busy ? 'Sending…' : 'Send booking request'}</button></div>
              </>}
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
