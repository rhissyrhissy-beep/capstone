import { useEffect, useState } from 'react'
import { Plus, X, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { subscribe } from '../lib/realtime'
import Layout from '../components/Layout'

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([])
  const [rentalBookings, setRentalBookings] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editRates, setEditRates] = useState({ daily_rate: '', price_per_km: '' })
  const [form, setForm] = useState({ make: '', model: '', year: '', plate_number: '', category: 'sedan', description: '', daily_rate: '', price_per_km: '', image: null })
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('availability')

  async function load() {
    try {
      const [fleet, activeBookings] = await Promise.all([
        api.get('/vehicles'),
        api.get('/bookings', { status: 'accepted,ongoing', sort: 'start_asc' }),
      ])
      setError('')
      setVehicles(fleet)
      setRentalBookings(activeBookings)
    } catch (loadError) {
      setError(loadError.message || 'Unable to load fleet rental dates.')
    }
  }

  useEffect(() => {
    load()
    return subscribe('bookings', load)
  }, [])

  const visibleVehicles = vehicles
    .filter((vehicle) => `${vehicle.make} ${vehicle.model} ${vehicle.plate_number} ${vehicle.category} ${vehicle.status}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((first, second) => {
      if (sortBy === 'rate-low') return Number(first.daily_rate) - Number(second.daily_rate)
      if (sortBy === 'rate-high') return Number(second.daily_rate) - Number(first.daily_rate)
      if (sortBy === 'name') return `${first.make} ${first.model}`.localeCompare(`${second.make} ${second.model}`)
      return (first.status === 'available' ? 0 : 1) - (second.status === 'available' ? 0 : 1)
    })

  async function addVehicle(e) {
    e.preventDefault()
    setError('')
    const vehicleData = {
      make: form.make.trim(), model: form.model.trim(), plate_number: form.plate_number.trim(), category: form.category,
      description: form.description.trim(),
      year: Number(form.year),
      daily_rate: Number(form.daily_rate),
      price_per_km: Number(form.price_per_km || 0),
      image_url: form.image_url || null,
    }
    try {
      if (editingVehicle) await api.patch(`/vehicles/${editingVehicle.id}`, vehicleData)
      else await api.post('/vehicles', vehicleData)
    } catch (saveError) {
      setError(saveError.message)
      return
    }
    setForm({ make: '', model: '', year: '', plate_number: '', category: 'sedan', description: '', daily_rate: '', price_per_km: '', image: null, image_url: '' })
    setEditingVehicle(null)
    setShowForm(false)
    load()
  }

  async function updateStatus(id, status) {
    try {
      await api.patch(`/vehicles/${id}`, { status })
    } catch (statusError) {
      setError(statusError.message)
    }
    load()
  }

  async function updateRates(id) {
    try {
      await api.patch(`/vehicles/${id}`, {
        daily_rate: Number(editRates.daily_rate),
        price_per_km: Number(editRates.price_per_km || 0),
      })
    } catch (rateError) {
      return setError(rateError.message)
    }
    setEditingId(null)
    load()
  }

  async function deleteVehicle(vehicle) {
    if (!window.confirm(`Delete ${vehicle.make} ${vehicle.model} (${vehicle.plate_number})? This cannot be undone.`)) return
    try {
      await api.delete(`/vehicles/${vehicle.id}`)
    } catch (deleteError) {
      setError(deleteError.message)
      return
    }
    load()
  }

  function startEditing(vehicle) {
    setEditingVehicle(vehicle)
    setForm({
      make: vehicle.make, model: vehicle.model, year: vehicle.year, plate_number: vehicle.plate_number,
      category: vehicle.category, daily_rate: vehicle.daily_rate, price_per_km: vehicle.price_per_km || 0,
      description: vehicle.description || '',
      image: null, image_url: vehicle.image_url || '',
    })
    setError('')
    setShowForm(true)
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold mb-1">Fleet</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Manage vehicles available for booking.</p>
        </div>
        <button onClick={() => { setEditingVehicle(null); setShowForm((s) => !s); setError('') }} className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
          {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? 'Close' : 'Add vehicle'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={addVehicle} className="card p-5 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {error && <p className="sm:col-span-3 text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
          <label className="flex flex-col gap-1 text-sm">Make<input required placeholder="Toyota" className="px-3 py-2" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-sm">Model<input required placeholder="Vios" className="px-3 py-2" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-sm">Year<input required type="number" min="1900" max="2100" placeholder="2024" className="px-3 py-2" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-sm">Plate number<input required placeholder="CDO-1005" className="px-3 py-2" value={form.plate_number} onChange={(e) => setForm({ ...form, plate_number: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-sm">Category<select className="px-3 py-2" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="sedan">Sedan</option><option value="suv">SUV</option><option value="van">Van</option><option value="pickup">Pickup</option>
          </select></label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-3">Customer-facing details<textarea rows={3} maxLength={4000} placeholder="Describe comfort, luggage space, features, and important vehicle notes." className="px-3 py-2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-sm">Base daily rate (PHP)<input required type="number" min="0" step="0.01" placeholder="1800" className="px-3 py-2" value={form.daily_rate} onChange={(e) => setForm({ ...form, daily_rate: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-sm">Distance rate (PHP/km)<input type="number" min="0" step="0.01" placeholder="50" className="px-3 py-2" value={form.price_per_km} onChange={(e) => setForm({ ...form, price_per_km: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-sm">Vehicle photo<input type="file" accept="image/*" className="px-3 py-2" onChange={async (e) => {
            const image = e.target.files?.[0]
            if (!image) return
            try {
              const body = new FormData()
              body.append('file', image)
              const { image_url } = await api.upload('/vehicles/images', body)
              setForm({ ...form, image, image_url })
            } catch (uploadError) {
              setError(`Image upload failed: ${uploadError.message}`)
            }
          }} /><span className="text-xs" style={{ color: 'var(--text-faint)' }}>{form.image_url ? 'Photo ready to save.' : 'Optional JPG or PNG.'}</span></label>
          <button type="submit" className="btn-primary py-2 sm:col-span-3">{editingVehicle ? 'Update vehicle' : 'Save vehicle'}</button>
        </form>
      )}

      {error && !showForm && <p role="alert" className="text-sm px-4 py-3 rounded-xl mb-4" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--danger)' }}>{error}</p>}

      <div className="flex flex-wrap gap-3 mb-5">
        <input aria-label="Search fleet" placeholder="Search make, model, plate, or status" value={search} onChange={(event) => setSearch(event.target.value)} className="px-3 py-2 text-sm flex-1 min-w-56" />
        <select aria-label="Sort vehicles" value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="px-3 py-2 text-sm">
          <option value="availability">Available first</option>
          <option value="name">Name: A to Z</option>
          <option value="rate-low">Daily rate: low to high</option>
          <option value="rate-high">Daily rate: high to low</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
              <th className="py-3 px-4 font-medium">Vehicle</th>
              <th className="py-3 px-4 font-medium">Plate</th>
              <th className="py-3 px-4 font-medium">Category</th>
              <th className="py-3 px-4 font-medium">Daily rate</th>
              <th className="py-3 px-4 font-medium">Per km</th>
              <th className="py-3 px-4 font-medium">Status</th>
              <th className="py-3 px-4 font-medium">Rental period</th>
              <th className="py-3 px-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleVehicles.map((vehicle) => (
              <tr key={vehicle.id} style={{ borderTop: '1px solid var(--border-soft)' }}>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    {vehicle.image_url && <img src={vehicle.image_url} alt="" className="w-14 h-10 rounded object-cover" />}
                    <div><p className="font-medium">{vehicle.make} {vehicle.model} '{String(vehicle.year).slice(-2)}</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{vehicle.year}</p>{vehicle.description && <p className="mt-1 max-w-56 whitespace-normal text-xs" style={{ color: 'var(--text-muted)' }}>{vehicle.description}</p>}</div>
                  </div>
                </td>
                <td className="py-3 px-4">{vehicle.plate_number}</td>
                <td className="py-3 px-4 capitalize">{vehicle.category}</td>
                <td className="py-3 px-4 whitespace-nowrap">
                  {editingId === vehicle.id ? <input type="number" min="0" step="0.01" aria-label="Daily rate" value={editRates.daily_rate} onChange={(event) => setEditRates({ ...editRates, daily_rate: event.target.value })} className="w-28 px-2 py-1.5" /> : `₱${Number(vehicle.daily_rate).toLocaleString()}`}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  {editingId === vehicle.id ? <input type="number" min="0" step="0.01" aria-label="Price per kilometer" value={editRates.price_per_km} onChange={(event) => setEditRates({ ...editRates, price_per_km: event.target.value })} className="w-24 px-2 py-1.5" /> : `₱${Number(vehicle.price_per_km || 0).toLocaleString()}`}
                </td>
                <td className="py-3 px-4">
                  <select value={vehicle.status} onChange={(event) => updateStatus(vehicle.id, event.target.value)} className="px-2 py-1.5 text-xs">
                    <option value="available">Available</option>
                    <option value="rented">Rented</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </td>
                <td className="py-3 px-4 align-top">
                  {rentalBookings.filter((booking) => booking.vehicle_id === vehicle.id).length > 0 ? (
                    <div className="grid gap-2">
                      {rentalBookings.filter((booking) => booking.vehicle_id === vehicle.id).map((booking) => (
                        <div key={booking.id} className="whitespace-nowrap">
                          <p className="text-xs font-medium">{booking.status === 'ongoing' ? 'Rented now' : 'Upcoming'}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{booking.start_date} → {booking.end_date}</p>
                          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{booking.profiles?.full_name || 'Customer'}</p>
                        </div>
                      ))}
                    </div>
                  ) : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>No rental scheduled</span>}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    {editingId === vehicle.id ? <>
                      <button onClick={() => updateRates(vehicle.id)} className="btn-primary px-3 py-1.5 text-xs">Save</button>
                      <button onClick={() => setEditingId(null)} className="btn-ghost px-3 py-1.5 text-xs">Cancel</button>
                    </> : <>
                      <button onClick={() => startEditing(vehicle)} className="btn-ghost px-3 py-1.5 text-xs">Edit</button>
                      <button onClick={() => { setEditingId(vehicle.id); setEditRates({ daily_rate: vehicle.daily_rate, price_per_km: vehicle.price_per_km || 0 }) }} className="btn-ghost px-3 py-1.5 text-xs">Pricing</button>
                      <button onClick={() => deleteVehicle(vehicle)} aria-label={`Delete ${vehicle.make} ${vehicle.model}`} className="btn-ghost p-2" style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                    </>}
                  </div>
                </td>
              </tr>
            ))}
            {visibleVehicles.length === 0 && <tr><td colSpan={8} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>No vehicles match this search.</td></tr>}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}
