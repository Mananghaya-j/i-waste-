import { useCallback, useEffect, useState } from 'react'
import { authenticatedRequest } from '../services/authApi.js'
import { listData } from '../utils/apiResponse.js'

const EMPTY_CHECKPOINT = { streetName: '', latitude: '', longitude: '' }
const EMPTY_TRUCK = {
  truckId: '',
  plateNumber: '',
  vehicleType: '',
  capacityKg: '',
  driverName: '',
  crew: '',
  adminId: '',
  status: 'IDLE',
}

function truckFormFrom(truck) {
  return truck ? {
    truckId: truck.truckId,
    plateNumber: truck.plateNumber,
    vehicleType: truck.vehicleType,
    capacityKg: truck.capacityKg ?? '',
    driverName: truck.driverName ?? '',
    crew: truck.crew ?? '',
    adminId: truck.adminId ?? '',
    status: truck.status,
  } : { ...EMPTY_TRUCK }
}

function routeFormFrom(route) {
  return route ? {
    form: {
      name: route.name,
      description: route.description ?? '',
      isActive: route.isActive,
    },
    checkpoints: route.checkpoints?.length
      ? route.checkpoints.map((stop) => ({
          streetName: stop.streetName,
          latitude: stop.latitude ?? '',
          longitude: stop.longitude ?? '',
        }))
      : [{ ...EMPTY_CHECKPOINT }],
  } : {
    form: { name: '', description: '', isActive: true },
    checkpoints: [{ ...EMPTY_CHECKPOINT }],
  }
}

function FleetManagement() {
  const [trucks, setTrucks] = useState([])
  const [routes, setRoutes] = useState([])
  const [admins, setAdmins] = useState([])
  const [selectedTruckId, setSelectedTruckId] = useState('')
  const [selectedRouteId, setSelectedRouteId] = useState('')
  const [truckForm, setTruckForm] = useState(EMPTY_TRUCK)
  const [routeForm, setRouteForm] = useState({ name: '', description: '', isActive: true })
  const [checkpoints, setCheckpoints] = useState([{ ...EMPTY_CHECKPOINT }])
  const [tripTruckId, setTripTruckId] = useState('')
  const [tripRouteId, setTripRouteId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [truckResult, routeResult, userResult] = await Promise.all([
        authenticatedRequest('/trucks/manage?limit=100'),
        authenticatedRequest('/routes/manage'),
        authenticatedRequest('/users/roles?limit=100'),
      ])
      setTrucks(listData(truckResult, 'truck'))
      setRoutes(listData(routeResult, 'route'))
      setAdmins(listData(userResult, 'user').filter((user) => user.role === 'ADMIN' && user.status === 'ACTIVE'))
    } catch (requestError) {
      setError(requestError.message || 'Fleet configuration could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => active && refresh())
    return () => { active = false }
  }, [refresh])

  async function submitTruck(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    const form = new FormData(event.currentTarget)
    const body = {
      truckId: form.get('truckId'),
      plateNumber: form.get('plateNumber'),
      vehicleType: form.get('vehicleType'),
      status: form.get('status'),
      capacityKg: form.get('capacityKg') ? Number(form.get('capacityKg')) : null,
      driverName: form.get('driverName') || null,
      crew: form.get('crew') || null,
      adminId: form.get('adminId') || null,
    }
    const currentTruck = trucks.find((truck) => truck.id === selectedTruckId)
    if (selectedTruckId && body.adminId === (currentTruck?.adminId ?? null)) delete body.adminId
    if (!selectedTruckId) {
      for (const key of ['capacityKg', 'driverName', 'crew', 'adminId', 'status']) {
        if (body[key] === null || key === 'status') delete body[key]
      }
    }
    try {
      const saved = await authenticatedRequest(
        selectedTruckId ? `/trucks/${selectedTruckId}` : '/trucks',
        { method: selectedTruckId ? 'PUT' : 'POST', body },
      )
      setNotice(`Truck ${saved.data.truckId} ${selectedTruckId ? 'updated' : 'registered'}.`)
      setSelectedTruckId(saved.data.id)
      setTruckForm(truckFormFrom(saved.data))
      await refresh()
    } catch (requestError) {
      setError(requestError.message || 'Truck information could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function submitRoute(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    const form = new FormData(event.currentTarget)
    const body = {
      name: form.get('name'),
      description: form.get('description') || null,
      isActive: form.get('isActive') === 'on',
      checkpoints: checkpoints.filter((stop) => stop.streetName.trim()).map((stop, index) => ({
        sequence: index + 1,
        streetName: stop.streetName.trim(),
        ...(stop.latitude !== '' ? { latitude: Number(stop.latitude) } : {}),
        ...(stop.longitude !== '' ? { longitude: Number(stop.longitude) } : {}),
      })),
    }
    try {
      const saved = await authenticatedRequest(
        selectedRouteId ? `/routes/${selectedRouteId}` : '/routes',
        { method: selectedRouteId ? 'PUT' : 'POST', body },
      )
      setNotice(`Route "${saved.data.name}" ${selectedRouteId ? 'updated' : 'created'}.`)
      setSelectedRouteId(saved.data.id)
      const savedRoute = routeFormFrom(saved.data)
      setRouteForm(savedRoute.form)
      setCheckpoints(savedRoute.checkpoints)
      await refresh()
    } catch (requestError) {
      setError(requestError.message || 'Route information could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function startTrip(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await authenticatedRequest('/trips', {
        method: 'POST',
        body: { truckId: tripTruckId, routeId: tripRouteId },
      })
      setNotice(`Route "${result.data.route?.name || 'route'}" assigned to truck ${result.data.truck.truckId}.`)
      await refresh()
    } catch (requestError) {
      setError(requestError.message || 'The route could not be assigned to this truck.')
    } finally {
      setSaving(false)
    }
  }

  function updateCheckpoint(index, field, value) {
    setCheckpoints((current) => current.map((stop, stopIndex) =>
      stopIndex === index ? { ...stop, [field]: value } : stop))
  }

  function selectTruck(id) {
    setSelectedTruckId(id)
    setTruckForm(truckFormFrom(trucks.find((truck) => truck.id === id)))
  }

  function selectRoute(id) {
    setSelectedRouteId(id)
    const selected = routeFormFrom(routes.find((route) => route.id === id))
    setRouteForm(selected.form)
    setCheckpoints(selected.checkpoints)
  }

  const selectedTruck = trucks.find((truck) => truck.id === selectedTruckId)

  return (
    <section className="admin-stack admin-fleet-management" aria-labelledby="fleet-management-title">
      <div className="admin-dashboard-panel">
        <div className="admin-panel-heading">
          <h3 id="fleet-management-title">Fleet configuration</h3>
          {loading && <span role="status">Loading fleet…</span>}
        </div>
        {error && <p className="admin-message admin-message--error" role="alert">{error}</p>}
        {notice && <p className="admin-message" role="status">{notice}</p>}
        <div className="admin-fleet-grid">
          <form className="admin-form admin-form--wide" onSubmit={submitTruck}>
            <h4>{selectedTruckId ? 'Update truck' : 'Register truck'}</h4>
            <label>Existing truck
              <select value={selectedTruckId} onChange={(event) => selectTruck(event.target.value)}>
                <option value="">Register a new truck</option>
                {trucks.map((truck) => <option key={truck.id} value={truck.id}>{truck.truckId} · {truck.plateNumber}</option>)}
              </select>
            </label>
            <div className="admin-junkshop-grid">
              <label>Truck ID<input name="truckId" value={truckForm.truckId} onChange={(event) => setTruckForm({ ...truckForm, truckId: event.target.value })} required minLength="2" maxLength="32" /></label>
              <label>Plate number<input name="plateNumber" value={truckForm.plateNumber} onChange={(event) => setTruckForm({ ...truckForm, plateNumber: event.target.value })} required minLength="2" maxLength="20" /></label>
              <label>Vehicle type<input name="vehicleType" value={truckForm.vehicleType} onChange={(event) => setTruckForm({ ...truckForm, vehicleType: event.target.value })} required minLength="2" maxLength="80" /></label>
              <label>Capacity (kg)<input name="capacityKg" type="number" min="0.01" max="100000" step="0.01" value={truckForm.capacityKg} onChange={(event) => setTruckForm({ ...truckForm, capacityKg: event.target.value })} /></label>
              <label>Driver name<input name="driverName" value={truckForm.driverName} onChange={(event) => setTruckForm({ ...truckForm, driverName: event.target.value })} maxLength="120" /></label>
              <label>Crew<input name="crew" value={truckForm.crew} onChange={(event) => setTruckForm({ ...truckForm, crew: event.target.value })} maxLength="500" /></label>
              <label>Assigned admin
                <select name="adminId" value={truckForm.adminId} onChange={(event) => setTruckForm({ ...truckForm, adminId: event.target.value })}>
                  <option value="">Unassigned</option>
                  {selectedTruck?.adminId && !admins.some((admin) => admin.id === selectedTruck.adminId) && (
                    <option value={selectedTruck.adminId} disabled>{selectedTruck.admin?.fullName || 'Inactive admin'} · currently assigned</option>
                  )}
                  {admins.map((admin) => <option key={admin.id} value={admin.id}>{admin.fullName}</option>)}
                </select>
              </label>
              {selectedTruckId && (
                <label>Status
                  <select name="status" value={truckForm.status} onChange={(event) => setTruckForm({ ...truckForm, status: event.target.value })}>
                    {['IDLE', 'ACTIVE', 'MAINTENANCE', 'ROUTE_COMPLETED'].map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
                  </select>
                </label>
              )}
            </div>
            <div className="admin-actions">
              <button className="admin-button" disabled={saving}>{saving ? 'Saving…' : selectedTruckId ? 'Save truck changes' : 'Register truck'}</button>
              {selectedTruckId && <button type="button" className="admin-button admin-button--quiet" onClick={() => selectTruck('')}>Cancel edit</button>}
            </div>
          </form>

          <form className="admin-form admin-form--wide" onSubmit={submitRoute}>
            <h4>{selectedRouteId ? 'Update collection route' : 'Create collection route'}</h4>
            <label>Existing route
              <select value={selectedRouteId} onChange={(event) => selectRoute(event.target.value)}>
                <option value="">Create a new route</option>
                {routes.map((route) => <option key={route.id} value={route.id}>{route.name}{route.isActive ? '' : ' · inactive'}</option>)}
              </select>
            </label>
            <label>Route name<input name="name" value={routeForm.name} onChange={(event) => setRouteForm({ ...routeForm, name: event.target.value })} required minLength="2" maxLength="120" /></label>
            <label>Description<input name="description" value={routeForm.description} onChange={(event) => setRouteForm({ ...routeForm, description: event.target.value })} maxLength="500" /></label>
            <label className="admin-checkbox-label"><input name="isActive" type="checkbox" checked={routeForm.isActive} onChange={(event) => setRouteForm({ ...routeForm, isActive: event.target.checked })} /> Active route</label>
            <fieldset className="admin-fleet-checkpoints">
              <legend>Stops in route order</legend>
              {checkpoints.map((stop, index) => (
                <div className="admin-fleet-checkpoint" key={index}>
                  <label>Stop {index + 1}<input value={stop.streetName} onChange={(event) => updateCheckpoint(index, 'streetName', event.target.value)} maxLength="160" placeholder="Street or landmark" /></label>
                  <label>Latitude<input type="number" min="-90" max="90" step="0.000001" value={stop.latitude} onChange={(event) => updateCheckpoint(index, 'latitude', event.target.value)} /></label>
                  <label>Longitude<input type="number" min="-180" max="180" step="0.000001" value={stop.longitude} onChange={(event) => updateCheckpoint(index, 'longitude', event.target.value)} /></label>
                  {checkpoints.length > 1 && <button type="button" className="admin-button admin-button--small admin-button--danger" onClick={() => setCheckpoints((current) => current.filter((_, stopIndex) => stopIndex !== index))}>Remove stop</button>}
                </div>
              ))}
              <button type="button" className="admin-button admin-button--small" disabled={checkpoints.length >= 200} onClick={() => setCheckpoints((current) => [...current, { ...EMPTY_CHECKPOINT }])}>Add route stop</button>
              <small>Enter both coordinates for each stop to display it on the map.</small>
            </fieldset>
            <div className="admin-actions">
              <button className="admin-button" disabled={saving}>{saving ? 'Saving…' : selectedRouteId ? 'Save route changes' : 'Create route'}</button>
              {selectedRouteId && <button type="button" className="admin-button admin-button--quiet" onClick={() => selectRoute('')}>New route</button>}
            </div>
          </form>
        </div>
      </div>

      <form className="admin-form admin-form--wide" onSubmit={startTrip}>
        <h3>Assign a route to a truck</h3>
        <div className="admin-junkshop-grid">
          <label>Truck
            <select value={tripTruckId} onChange={(event) => setTripTruckId(event.target.value)} required>
              <option value="">Select an available truck</option>
              {trucks.filter((truck) => truck.status !== 'MAINTENANCE' && !truck.trips?.some((trip) => trip.status === 'ACTIVE'))
                .map((truck) => <option key={truck.id} value={truck.id}>{truck.truckId} · {truck.plateNumber}</option>)}
            </select>
          </label>
          <label>Active route
            <select value={tripRouteId} onChange={(event) => setTripRouteId(event.target.value)} required>
              <option value="">Select a route</option>
              {routes.filter((route) => route.isActive).map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}
            </select>
          </label>
        </div>
        <p className="admin-panel-note">Starting a trip creates a live route ticket and changes the truck status to Active.</p>
        <button className="admin-button" disabled={saving || !tripTruckId || !tripRouteId}>{saving ? 'Assigning…' : 'Assign route and start trip'}</button>
      </form>
    </section>
  )
}

export default FleetManagement
