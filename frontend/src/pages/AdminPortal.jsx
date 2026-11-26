import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import FleetManagement from '../components/FleetManagement.jsx'
import RouteMap from '../components/RouteMap.jsx'
import { authenticatedDownload, authenticatedRequest, authenticatedUpload, publicRequest } from '../services/authApi.js'
import { useAuth } from '../hooks/useAuth.js'
import { paginatedData } from '../utils/apiResponse.js'
import '../styles/admin.css'

const requestCollections = [
  ['pickup-requests', 'Pickup requests'],
  ['tree-requests', 'Tree requests'],
  ['waterway-requests', 'Waterway requests'],
  ['environmental-reports', 'Environmental reports'],
  ['recyclables-requests', 'Recyclables'],
]

const requestStatuses = ['SUBMITTED', 'UNDER_REVIEW', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED']
const operationSources = [
  { path: '/tree-requests', key: 'tree', label: 'Tree requests' },
  { path: '/environmental-reports', key: 'report', label: 'Environmental reports' },
  { path: '/waterway-requests', key: 'waterway', label: 'Waterway requests' },
  { path: '/pickup-requests', key: 'pickup', label: 'Pickup requests' },
  { path: '/recyclables-requests', key: 'recyclables', label: 'Recyclables requests' },
]
const operationalSections = new Set(['dashboard', 'schedule', 'fleet', 'map'])
const currentMonth = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function RequestTable({ requests, collection, onUpdate, canUpdateStatus, investigators, trucks }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead><tr><th>Reference</th><th>Request</th><th>Submitted</th><th>Update status</th></tr></thead>
        <tbody>
          {requests.map((request) => (
            <tr key={request.id}>
              <td><strong>{request.referenceNo}</strong><small>{request.anonymous ? 'Anonymous' : request.fullName || 'Name not provided'}</small></td>
              <td>{request.location || request.pickupAddress || request.address || request.materialType || request.category || request.type || 'Service request'}<small>{request.contactNumber || request.email || ''}</small></td>
              <td>{new Date(request.createdAt).toLocaleString()}</td>
              <td>
                {canUpdateStatus
                  ? <form className="admin-status-form" onSubmit={(event) => onUpdate(event, collection, request)}>
                      <select name="status" defaultValue={request.status} aria-label={`Status for ${request.referenceNo}`}>
                        {requestStatuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
                      </select>
                      {collection === 'environmental-reports' && (
                        <select name="assignedInvestigatorId" defaultValue={request.assignedInvestigatorId || ''} aria-label={`Investigator for ${request.referenceNo}`}>
                          <option value="">Unassigned</option>
                          {investigators.map((investigator) => <option key={investigator.id} value={investigator.id}>{investigator.fullName}</option>)}
                        </select>
                      )}
                      {['pickup-requests', 'recyclables-requests'].includes(collection) && (
                        <select name="assignedTruckId" defaultValue={request.assignedTruckId || ''} aria-label={`Truck for ${request.referenceNo}`}>
                          <option value="">No truck assigned</option>
                          {trucks.map((truck) => <option key={truck.id} value={truck.id}>{truck.truckId} · {truck.plateNumber}</option>)}
                        </select>
                      )}
                      {collection === 'pickup-requests' && request.status !== 'COMPLETED' && (
                        <>
                          <input name="measuredWasteKg" type="number" min="0" max="100000" step="0.01" placeholder="Total collected kg" aria-label="Measured total waste kg" />
                          <input name="measuredRecyclablesKg" type="number" min="0" max="100000" step="0.01" placeholder="Recyclables kg (0 if none)" aria-label="Measured recyclables kg" />
                          <input name="measuredCompostKg" type="number" min="0" max="100000" step="0.01" placeholder="Compost kg (0 if none)" aria-label="Measured compost kg" />
                        </>
                      )}
                      {collection === 'recyclables-requests' && request.status !== 'COMPLETED' && (
                        <input name="actualCollectedKg" type="number" min="0" max="100000" step="0.01" placeholder="Actual collected kg" aria-label="Actual recyclable weight kg" />
                      )}
                      <input name={collection === 'environmental-reports' ? 'investigationNotes' : 'adminNotes'} placeholder="Internal note (optional)" maxLength={1500} />
                      <input name="proofOfCompletion" type="file" accept=".jpg,.jpeg,.png,.webp" aria-label="Proof of completion, if required" />
                      <button className="admin-button admin-button--small" type="submit">Save</button>
                    </form>
                  : request.status.replaceAll('_', ' ')}
              </td>
            </tr>
          ))}
          {!requests.length && <tr><td colSpan="4">No requests found.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function AdminPortal() {
  const { user, status, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const superAdmin = user?.role === 'SUPER_ADMIN'
  const [section, setSection] = useState('dashboard')
  const [collection, setCollection] = useState(requestCollections[0][0])
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [investigators, setInvestigators] = useState([])
  const [trucks, setTrucks] = useState([])
  const [dashboardRequests, setDashboardRequests] = useState([])
  const [routeData, setRouteData] = useState(null)
  const [operationsError, setOperationsError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const visibleSection = section

  const refresh = useCallback(async () => {
    if (!user) return
    const endpoints = {
      dashboard: '/dashboard/stats',
      schedule: '/dashboard/stats',
      fleet: '/dashboard/stats',
      map: '/dashboard/stats',
      requests: `/${collection}?page=${page}&limit=50`,
      announcements: `/announcements/manage?page=${page}&limit=50`,
      users: `/users/roles?page=${page}&limit=50`,
    }
    if (!endpoints[visibleSection]) return
    setResult(null)
    setLoading(true)
    setError('')
    try {
      const request = authenticatedRequest(endpoints[visibleSection])
      const investigatorRequest = visibleSection === 'requests' && collection === 'environmental-reports'
        ? authenticatedRequest('/investigators')
        : Promise.resolve({ data: [] })
      const truckRequest = visibleSection === 'requests' && ['pickup-requests', 'recyclables-requests'].includes(collection)
        ? authenticatedRequest('/trucks?limit=100')
        : Promise.resolve({ data: [] })
      const operationsRequest = operationalSections.has(visibleSection)
        ? Promise.allSettled([
            publicRequest('/public/dashboard'),
            ...(user.role === 'ADMIN'
              ? operationSources.map(({ path }) => authenticatedRequest(`${path}?page=1&limit=100`))
              : []),
          ])
        : Promise.resolve(null)
      const [data, investigatorData, truckData, operationsData] = await Promise.all([
        request,
        investigatorRequest,
        truckRequest,
        operationsRequest,
      ])
      setResult(['requests', 'announcements', 'users'].includes(visibleSection)
        ? paginatedData(data, visibleSection)
        : data)
      setInvestigators(investigatorData.data || [])
      setTrucks(truckData.data || [])
      if (operationsData) {
        const [mapResult, ...requestResults] = operationsData
        setRouteData(mapResult.status === 'fulfilled' ? mapResult.value.data : null)
        if (user.role === 'ADMIN') {
          const records = []
          const unavailableSources = []
          requestResults.forEach((sourceResult, index) => {
            if (sourceResult.status === 'fulfilled') {
              const items = sourceResult.value.data || []
              items.forEach((item) => records.push({ ...item, operationKind: operationSources[index].key }))
            } else {
              unavailableSources.push(operationSources[index].label)
            }
          })
          setDashboardRequests(records)
          setOperationsError([
            ...(mapResult.status === 'rejected' ? ['truck map'] : []),
            ...unavailableSources,
          ].length
            ? `Live data unavailable for ${[
                ...(mapResult.status === 'rejected' ? ['truck map'] : []),
                ...unavailableSources,
              ].join(', ')}.`
            : '')
        } else {
          setDashboardRequests([])
          setOperationsError(mapResult.status === 'rejected' ? 'Live truck map is unavailable.' : '')
        }
      }
    } catch (requestError) {
      setError(requestError.message || 'Unable to load administration data.')
    } finally {
      setLoading(false)
    }
  }, [collection, page, user, visibleSection])

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => active && refresh())
    return () => { active = false }
  }, [refresh])

  useEffect(() => {
    if (visibleSection !== 'dashboard') return undefined
    const timer = window.setInterval(refresh, 30000)
    return () => window.clearInterval(timer)
  }, [refresh, visibleSection])

  if (status === 'loading') return <main className="admin-loading">Checking administrator session…</main>
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location }} />
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) return <Navigate to="/" replace />
  if (user.role === 'ADMIN' && location.pathname.startsWith('/super-admin')) return <Navigate to="/admin" replace />
  if (superAdmin && location.pathname === '/admin') return <Navigate to="/super-admin" replace />

  async function runAction(action, successMessage) {
    setError('')
    setNotice('')
    try {
      await action()
      setNotice(successMessage)
      await refresh()
      return true
    } catch (requestError) {
      setError(requestError.message || 'The action could not be completed.')
      return false
    }
  }

  async function signOut() {
    try {
      await logout()
    } catch (logoutError) {
      setError(logoutError.message || 'Unable to end your session.')
    }
    navigate('/')
  }

  async function updateRequest(event, requestCollection, request) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const body = new FormData()
    const nextStatus = formData.get('status')
    body.append('status', nextStatus)
    const noteField = requestCollection === 'environmental-reports' ? 'investigationNotes' : 'adminNotes'
    if (formData.get(noteField)) body.append(noteField, formData.get(noteField))
    for (const field of ['assignedInvestigatorId', 'assignedTruckId']) {
      if (formData.get(field)) body.append(field, formData.get(field))
    }
    if (nextStatus === 'COMPLETED' && requestCollection === 'pickup-requests') {
      for (const field of ['measuredWasteKg', 'measuredRecyclablesKg', 'measuredCompostKg']) {
        const value = formData.get(field)
        if (value !== null && value !== '') body.append(field, value)
      }
    }
    if (nextStatus === 'COMPLETED' && requestCollection === 'recyclables-requests') {
      const value = formData.get('actualCollectedKg')
      if (value !== null && value !== '') body.append('actualCollectedKg', value)
    }
    const proof = formData.get('proofOfCompletion')
    if (proof instanceof File && proof.size) body.append('proofOfCompletion', proof)
    await runAction(
      () => authenticatedUpload(`/${requestCollection}/${request.id}/status`, body),
      `Request ${request.referenceNo} updated.`,
    )
  }

  async function downloadReport(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const query = new URLSearchParams({
      type: form.get('type'),
      format: form.get('format'),
    })
    try {
      const file = await authenticatedDownload(`/reports/export?${query}`)
      const url = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = url
      link.download = `i-waste-${form.get('type')}-report.${form.get('format')}`
      link.click()
      URL.revokeObjectURL(url)
      setNotice('Report downloaded.')
    } catch (requestError) {
      setError(requestError.message || 'Unable to export report.')
    }
  }

  const permissions = user.permissions || []
  const canManageRequests = permissions.includes('requests:manage') || permissions.includes('requests:update_status')
  const canManageReports = superAdmin || permissions.includes('reports:manage')
  const navigation = [
    ['dashboard', 'Dashboard', true],
    ['requests', 'Service Requests', canManageRequests],
    ['reports', 'Reports', canManageReports],
    ['schedule', 'Collection Schedule', canManageRequests],
    ['fleet', 'Fleet Tracking', true],
    ['map', 'Map View', true],
    ['announcements', 'Announcements', permissions.includes('announcements:manage')],
    ['analytics', 'Analytics', canManageReports],
    ['users', 'Users', superAdmin],
    ['settings', 'Settings', superAdmin],
    ['junkshop', 'Junkshop reporting', canManageReports],
  ]
  const urgentAlertCount = dashboardRequests.filter((request) =>
    isUrgentRecord(request) && !['COMPLETED', 'REJECTED'].includes(request.status),
  ).length

  return (
    <div className="admin-portal">
      <header className="admin-header">
        <div><p>i-WASTE ADMINISTRATION</p><h1>{superAdmin ? 'Super admin portal' : 'Admin dashboard'}</h1></div>
        <div className="admin-identity">
          <div className="admin-alert-counter" role="status" aria-label={`${urgentAlertCount} urgent alerts`}>
            <span>Active alerts</span><strong>{urgentAlertCount}</strong>
          </div>
          <Link className="admin-profile-link" to="/profile" state={{ backgroundLocation: location }}>{user.fullName} · Profile</Link>
          <button className="admin-button admin-button--quiet" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <div className="admin-shell">
        <nav className="admin-sidebar" aria-label="Administration">
          {navigation.map(([key, label, available]) => (
            <button
              type="button"
              key={key}
              className={visibleSection === key ? 'is-active' : ''}
              disabled={!available}
              title={available ? undefined : 'This section is not available for your account.'}
              onClick={() => { setSection(key); setPage(1); setResult(null); setError(''); setNotice('') }}
            >
              {label}
            </button>
          ))}
        </nav>
        <main className="admin-content">
          <div className="admin-content-heading"><div><p>ADMINISTRATION</p><h2>{navigation.find(([key]) => key === visibleSection)?.[1]}</h2></div>{loading && <span role="status">Loading…</span>}</div>
          {error && <p className="admin-message admin-message--error" role="alert">{error}</p>}
          {notice && <p className="admin-message" role="status">{notice}</p>}
          {visibleSection === 'dashboard' && (
            <Dashboard
              data={result?.data}
              requests={dashboardRequests}
              routeData={routeData}
              operationsError={operationsError}
              canViewActivity={user.role === 'ADMIN'}
            />
          )}
          {visibleSection === 'requests' && (
            <>
              <label className="admin-filter">Request type
                <select value={collection} onChange={(event) => { setCollection(event.target.value); setPage(1) }}>
                  {requestCollections.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <RequestTable
                requests={result?.data || []}
                collection={collection}
                onUpdate={updateRequest}
                canUpdateStatus={permissions.includes('requests:update_status')}
                investigators={investigators}
                trucks={trucks}
              />
              <Pagination pagination={result?.pagination} onChange={setPage} />
            </>
          )}
          {visibleSection === 'reports' && <ReportSection onDownload={downloadReport} />}
          {visibleSection === 'analytics' && <ReportSection onDownload={downloadReport} />}
          {visibleSection === 'junkshop' && <JunkshopReporting />}
          {visibleSection === 'schedule' && <CollectionSchedule requests={dashboardRequests} error={operationsError} />}
          {visibleSection === 'fleet' && <FleetSection data={result?.data} routeData={routeData} requests={dashboardRequests} error={operationsError} superAdmin={superAdmin} />}
          {visibleSection === 'map' && <MapSection routeData={routeData} requests={dashboardRequests} error={operationsError} />}
          {visibleSection === 'announcements' && (
            <>
              <Announcements
                announcements={result?.data || []}
                onCreate={(body) => runAction(() => authenticatedRequest('/announcements', { body }), 'Announcement saved.')}
                onUpdate={(id, body) => runAction(() => authenticatedRequest(`/announcements/${id}`, { method: 'PATCH', body }), 'Announcement updated.')}
                onDelete={(id) => runAction(() => authenticatedRequest(`/announcements/${id}`, { method: 'DELETE' }), 'Announcement deleted.')}
              />
              <Pagination pagination={result?.pagination} onChange={setPage} />
            </>
          )}
          {visibleSection === 'users' && superAdmin && (
            <>
              <UserRoleManagement
                users={result?.data || []}
                currentUserId={user.id}
                onSave={(id, role) => runAction(
                  () => authenticatedRequest(`/users/${id}/role`, { method: 'PATCH', body: { role } }),
                  'User role updated.',
                )}
              />
              <Pagination pagination={result?.pagination} onChange={setPage} />
            </>
          )}
          {visibleSection === 'settings' && superAdmin && <SettingsSection />}
        </main>
      </div>
    </div>
  )
}

function isUrgentRecord(record) {
  const priority = `${record.priority || ''} ${record.severity || ''}`
  const description = `${record.description || ''} ${record.hazardDescription || ''}`
  return /\burgent\b|\bemergency\b/i.test(priority) || /\burgent\b|\bemergency\b/i.test(description)
}

function activityTitle(record) {
  if (record.operationKind === 'tree') return record.requestType === 'PRUNING' ? 'Tree pruning' : 'Tree cutting'
  if (record.operationKind === 'report') {
    return {
      ILLEGAL_DUMPING: 'Illegal dumping',
      MISSED_COLLECTION: 'Missed collection',
      OTHER: 'Environmental report',
    }[record.type] || 'Environmental report'
  }
  if (record.operationKind === 'waterway') {
    return /clog|drain/i.test(record.issueType || '') ? 'Clogged waterways' : 'Waterway cleaning'
  }
  return 'Service request'
}

function statusGroup(record) {
  if (record.status === 'COMPLETED') return 'Completed'
  if (record.status === 'IN_PROGRESS') return 'In Progress'
  if (record.status === 'SCHEDULED' || record.assignedTruckId || record.assignedInvestigatorId) return 'Assigned'
  if (['SUBMITTED', 'UNDER_REVIEW'].includes(record.status)) return 'Pending'
  return null
}

function statusTone(record) {
  if (record.status === 'COMPLETED') return 'completed'
  if (isUrgentRecord(record)) return 'urgent'
  if (record.status === 'SCHEDULED' || record.assignedTruckId || record.assignedInvestigatorId) return 'assigned'
  if (record.status === 'IN_PROGRESS') return 'in-progress'
  if (['SUBMITTED', 'UNDER_REVIEW'].includes(record.status)) return 'pending'
  return 'neutral'
}

function formatActivityTime(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString()
}

function requestLocation(record) {
  return record.location || record.pickupAddress || record.address || 'Location not provided'
}

function Dashboard({ data, requests, routeData, operationsError, canViewActivity }) {
  if (!data) return <p>Administration metrics will appear here.</p>
  const reportRequests = requests.filter((request) => request.operationKind === 'report')
  const openEnvironmentalReports = reportRequests.filter((request) => !['COMPLETED', 'REJECTED'].includes(request.status))
  const activeReports = requests.filter((request) =>
    ['report', 'tree', 'waterway'].includes(request.operationKind) &&
    !['COMPLETED', 'REJECTED'].includes(request.status),
  )
  const recentReports = reportRequests.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5)
  const recentActivity = requests
    .filter((request) => ['tree', 'report', 'waterway'].includes(request.operationKind))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8)
  const groups = requests.reduce((counts, request) => {
    const group = statusGroup(request)
    if (group) counts[group] += 1
    return counts
  }, { Pending: 0, Assigned: 0, 'In Progress': 0, Completed: 0 })
  const urgentCount = activeReports.filter(isUrgentRecord).length

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard-intro">
        <div>
          <p className="admin-live-label"><span aria-hidden="true">🌿</span> LIVE OPERATIONS</p>
          <p>Service activity and fleet records refresh every 30 seconds.</p>
        </div>
        <span className="admin-dashboard-alert"><strong>{urgentCount}</strong> urgent reports</span>
      </div>
      <section className="admin-kpi-grid" aria-label="Operational key performance indicators">
        <article className="admin-kpi-card">
          <span>Active requests</span><strong>{data.requests?.active ?? 0}</strong>
          <small>Awaiting completion</small>
        </article>
        <article className="admin-kpi-card admin-kpi-card--pending">
          <span>Pending requests</span><strong>{data.requests?.pending ?? 0}</strong>
          <small>Submitted or under review</small>
        </article>
        <article className="admin-kpi-card admin-kpi-card--urgent">
          <span>Urgent reports</span><strong>{urgentCount}</strong>
          <small>Explicit urgent/emergency flags</small>
        </article>
        <article className="admin-kpi-card">
          <span>Active collection trucks</span><strong>{data.trucks?.active ?? 0}<small> / {data.trucks?.total ?? 0}</small></strong>
          <small>Current fleet availability</small>
        </article>
      </section>
      <div className="admin-dashboard-grid">
        <section className="admin-dashboard-panel" aria-labelledby="admin-status-overview-title">
          <div className="admin-panel-heading">
            <h3 id="admin-status-overview-title"><span aria-hidden="true">♻</span> Request status overview</h3>
            <small>Latest 100 records per service</small>
          </div>
          <div className="admin-status-overview">
            {[
              ['Pending', 'SUBMITTED / UNDER REVIEW'],
              ['Assigned', 'SCHEDULED'],
              ['In Progress', 'IN PROGRESS'],
              ['Completed', 'COMPLETED'],
            ].map(([label, hint]) => (
              <div className="admin-status-row" key={label}>
                <span className={`admin-status-dot admin-status-dot--${label.toLowerCase().replaceAll(' ', '-')}`} aria-hidden="true" />
                <span>{label}<small>{hint}</small></span>
                <strong>{groups[label]}</strong>
              </div>
            ))}
          </div>
          {!canViewActivity && <p className="admin-panel-note">Detailed service requests are not available to this role.</p>}
        </section>

        <section className="admin-dashboard-panel" aria-labelledby="admin-recent-reports-title">
          <div className="admin-panel-heading">
            <h3 id="admin-recent-reports-title">Recent reports</h3>
            <span className="admin-panel-count">{openEnvironmentalReports.length} open</span>
          </div>
          <div className="admin-report-feed">
            {recentReports.map((report) => (
              <article className="admin-report-item" key={report.id}>
                <div className="admin-report-item-heading">
                  <strong>{activityTitle(report)}</strong>
                  <StatusBadge record={report} />
                </div>
                <span>{report.referenceNo} · {requestLocation(report)}</span>
                <small>{formatActivityTime(report.createdAt)}</small>
              </article>
            ))}
            {!recentReports.length && <p className="admin-panel-empty">No recent environmental reports.</p>}
          </div>
        </section>

        <section className="admin-dashboard-panel" aria-labelledby="admin-activity-title">
          <div className="admin-panel-heading">
            <h3 id="admin-activity-title"><span aria-hidden="true">🌱</span> Live activity</h3>
            <span className="admin-live-indicator"><i aria-hidden="true" /> Live</span>
          </div>
          <div className="admin-activity-feed" aria-live="polite">
            {recentActivity.map((item) => (
              <article className="admin-activity-item" key={`${item.operationKind}-${item.id}`}>
                <span className={`admin-activity-icon admin-activity-icon--${item.operationKind}`} aria-hidden="true">
                  {item.operationKind === 'tree' ? '🌳' : item.operationKind === 'waterway' ? '≋' : '♻'}
                </span>
                <div>
                  <div className="admin-report-item-heading">
                    <strong>{activityTitle(item)}</strong><StatusBadge record={item} />
                  </div>
                  <span>{item.referenceNo} · {requestLocation(item)}</span>
                  <small>{formatActivityTime(item.createdAt)}</small>
                </div>
              </article>
            ))}
            {!recentActivity.length && (
              <p className="admin-panel-empty">
                {canViewActivity ? 'No recent tree, environmental, or waterway activity.' : 'Activity details are not available to this role.'}
              </p>
            )}
          </div>
        </section>

        <OperationsMap routeData={routeData} requests={requests} />

        <TruckMonitoring data={data} />
      </div>
      {operationsError && <p className="admin-message admin-message--error" role="alert">{operationsError}</p>}
    </div>
  )
}

function StatusBadge({ record }) {
  const tone = statusTone(record)
  const label = tone === 'urgent' ? 'Urgent' : (record.status || 'Unknown').replaceAll('_', ' ')
  return <span className={`admin-status-badge admin-status-badge--${tone}`}>{label}</span>
}

function OperationsMap({ routeData, requests }) {
  const activeRoute = routeData?.activeRoute
  const routeStops = (activeRoute?.checkpoints || []).map((stop, index) => ({
    ...stop,
    id: `${activeRoute.tripNo}-${index}`,
    routeName: activeRoute.truckId,
  }))
  const currentStop = routeStops.find((stop) =>
    stop.name?.toLocaleLowerCase() === activeRoute?.currentStreet?.toLocaleLowerCase(),
  ) || routeStops.find((stop) => stop.state === 'current')
  const routeTrucks = activeRoute && currentStop?.position
    ? [{
        position: currentStop.position,
        title: `Truck ${activeRoute.truckId}`,
        subtitle: activeRoute.currentStreet || 'Active route',
      }]
    : []
  const activeReports = requests.filter((request) =>
    ['report', 'tree', 'waterway'].includes(request.operationKind) &&
    !['COMPLETED', 'REJECTED'].includes(request.status),
  )
  const reportMarkers = activeReports.flatMap((report) => {
    const position = recordPosition(report)
    return position ? [{
      id: report.id,
      referenceNo: report.referenceNo,
      title: activityTitle(report),
      status: statusTone(report),
      position,
    }] : []
  })

  return (
    <section className="admin-dashboard-panel admin-map-panel" aria-labelledby="admin-map-title">
      <div className="admin-panel-heading">
        <h3 id="admin-map-title">Operations map</h3>
        <span className="admin-panel-count">{activeReports.length} active reports · {routeTrucks.length} mapped trucks</span>
      </div>
      <div className="admin-map-frame">
        <RouteMap
          routes={routeStops.length ? [{ id: activeRoute.tripNo, routeName: activeRoute.truckId, stops: routeStops }] : []}
          trucks={routeTrucks}
          reports={reportMarkers}
        />
      </div>
      <div className="admin-map-legend" aria-label="Map legend">
        <span><i className="admin-map-legend-dot admin-map-legend-dot--truck" />Collection truck</span>
        <span><i className="admin-map-legend-dot admin-map-legend-dot--urgent" />Urgent</span>
        <span><i className="admin-map-legend-dot admin-map-legend-dot--pending" />Pending report</span>
        <span><i className="admin-map-legend-dot admin-map-legend-dot--assigned" />Assigned report</span>
        <span><i className="admin-map-legend-dot admin-map-legend-dot--route" />Collection route</span>
      </div>
      {activeReports.length > 0 && !reportMarkers.length && (
        <p className="admin-panel-note">Request locations are stored as addresses, so they cannot be pinned until coordinates are available.</p>
      )}
      {!activeReports.length && <p className="admin-panel-note">No open tree, environmental, or waterway reports to map.</p>}
      {activeRoute && !routeTrucks.length && <p className="admin-panel-note">The active truck has no route checkpoint coordinates to map yet.</p>}
    </section>
  )
}

function recordPosition(record) {
  const position = Array.isArray(record.position)
    ? record.position
    : [record.latitude ?? record.lat, record.longitude ?? record.lng]
  if (position.length < 2 || position[0] == null || position[1] == null) return null
  const latitude = Number(position[0])
  const longitude = Number(position[1])
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
  return [latitude, longitude]
}

function TruckMonitoring({ data }) {
  const monitoring = data?.trucks?.monitoring || []
  return (
    <section className="admin-dashboard-panel admin-truck-monitoring" aria-labelledby="admin-truck-monitoring-title">
      <div className="admin-panel-heading">
        <h3 id="admin-truck-monitoring-title">Collection fleet</h3>
        <span className="admin-panel-count">{monitoring.length} active</span>
      </div>
      {monitoring.map((truck) => (
        <article key={truck.id}>
          <div>
            <h4>{truck.truckId} · {truck.plateNumber}</h4>
            <small>{truck.currentStreet ? `Last recorded at ${truck.currentStreet}` : 'No route checkpoint recorded yet'}</small>
          </div>
          <span className="admin-status-badge admin-status-badge--completed">Active</span>
        </article>
      ))}
      {!monitoring.length && <p className="admin-panel-empty">No trucks are currently active.</p>}
    </section>
  )
}

function CollectionSchedule({ requests, error }) {
  const scheduled = requests
    .filter((request) => request.status === 'SCHEDULED')
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  return (
    <section className="admin-dashboard-panel admin-schedule-panel" aria-labelledby="admin-schedule-title">
      <div className="admin-panel-heading">
        <h3 id="admin-schedule-title">Scheduled service requests</h3>
        <span className="admin-panel-count">{scheduled.length} scheduled</span>
      </div>
      {error && <p className="admin-message admin-message--error" role="alert">{error}</p>}
      {scheduled.length ? scheduled.map((request) => (
        <article className="admin-schedule-item" key={`${request.operationKind}-${request.id}`}>
          <div><strong>{activityTitle(request)}</strong><small>{request.referenceNo} · {requestLocation(request)}</small></div>
          <StatusBadge record={request} />
        </article>
      )) : <p className="admin-panel-empty">No scheduled requests are available in the current activity window.</p>}
    </section>
  )
}

function FleetSection({ data, routeData, requests, error, superAdmin }) {
  return (
    <div className="admin-stack">
      {error && <p className="admin-message admin-message--error" role="alert">{error}</p>}
      <OperationsMap routeData={routeData} requests={requests} />
      <TruckMonitoring data={data} />
      {superAdmin && <FleetManagement />}
    </div>
  )
}

function MapSection({ routeData, requests, error }) {
  return (
    <div className="admin-stack">
      {error && <p className="admin-message admin-message--error" role="alert">{error}</p>}
      <OperationsMap routeData={routeData} requests={requests} />
    </div>
  )
}

function SettingsSection() {
  return (
    <section className="admin-dashboard-panel">
      <h3>System settings</h3>
      <p className="admin-panel-note">System settings are not available in this portal yet.</p>
    </section>
  )
}

function Pagination({ pagination, onChange }) {
  if (!pagination || pagination.pages <= 1) return null
  return (
    <div className="admin-pagination">
      <button className="admin-button admin-button--small" disabled={pagination.page <= 1} onClick={() => onChange(pagination.page - 1)}>Previous</button>
      <span>Page {pagination.page} of {pagination.pages} · {pagination.total} records</span>
      <button className="admin-button admin-button--small" disabled={pagination.page >= pagination.pages} onClick={() => onChange(pagination.page + 1)}>Next</button>
    </div>
  )
}

function ReportSection({ onDownload }) {
  return (
    <div className="admin-stack">
      <MonthlyVolumeReports />
      <form className="admin-form admin-report-form" onSubmit={onDownload}>
        <h3>Request and activity exports</h3>
        <label>Report type<select name="type"><option value="pickup">Pickup requests</option><option value="land">Tree requests</option><option value="water">Waterway requests</option><option value="environmental">Environmental reports</option><option value="trips">Trip tickets</option></select></label>
        <label>Format<select name="format"><option value="csv">CSV</option><option value="xlsx">Excel</option><option value="pdf">PDF</option></select></label>
        <button className="admin-button">Download report</button>
      </form>
    </div>
  )
}

function MonthlyVolumeReports() {
  const [month, setMonth] = useState(currentMonth)
  const [household, setHousehold] = useState('')
  const [truckId, setTruckId] = useState('')
  const [trucks, setTrucks] = useState([])
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [format, setFormat] = useState('csv')

  useEffect(() => {
    let active = true
    authenticatedRequest('/trucks?limit=100')
      .then((response) => active && setTrucks(response.data || []))
      .catch((requestError) => active && setError(requestError.message || 'Truck list is unavailable.'))
    return () => { active = false }
  }, [])

  async function loadReport(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    const query = new URLSearchParams({ month })
    if (truckId) query.set('truckId', truckId)
    if (household.trim()) query.set('household', household.trim())
    try {
      const response = await authenticatedRequest(`/reports/volumes?${query}`)
      setReport(response.data)
    } catch (requestError) {
      setError(requestError.message || 'Monthly volume report could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  async function exportReport() {
    setError('')
    const query = new URLSearchParams({ type: 'volumes', format, month })
    if (truckId) query.set('truckId', truckId)
    if (household.trim()) query.set('household', household.trim())
    try {
      const file = await authenticatedDownload(`/reports/export?${query}`)
      const url = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = url
      link.download = `i-waste-monthly-volumes-${month}.${format}`
      link.click()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(requestError.message || 'Unable to export monthly volumes.')
    }
  }

  const kg = (value) => `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`
  return (
    <section className="admin-stack" aria-labelledby="volume-report-title">
      <form className="admin-form admin-form--wide admin-volume-filters" onSubmit={loadReport}>
        <h3 id="volume-report-title">Monthly waste and recycling volumes</h3>
        <label>Month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} required /></label>
        <label>Truck
          <select value={truckId} onChange={(event) => setTruckId(event.target.value)}>
            <option value="">All trucks</option>
            {trucks.map((truck) => <option key={truck.id} value={truck.id}>{truck.truckId} · {truck.plateNumber}</option>)}
          </select>
        </label>
        <label>HOA / household address<input value={household} onChange={(event) => setHousehold(event.target.value)} maxLength={300} placeholder="Filter by pickup address" /></label>
        <button className="admin-button" disabled={loading}>{loading ? 'Loading…' : 'Apply filters'}</button>
      </form>
      {error && <p className="admin-message admin-message--error" role="alert">{error}</p>}
      {report && (
        <>
          {report.summary.reconciliationExcessKg > 0 && (
            <p className="admin-message admin-message--error" role="alert">
              Recyclable weight exceeds recorded collection weight by {kg(report.summary.reconciliationExcessKg)}. Review the truck and junkshop entries before finalizing landfill totals.
            </p>
          )}
          <div className="admin-metrics">
            <article><span>Total recorded collection weight</span><strong>{kg(report.summary.totalWasteKg)}</strong></article>
            <article><span>Junkshop recyclables</span><strong>{kg(report.summary.junkshopRecyclablesKg)}</strong><small>{Number(report.summary.junkshopRecyclablesM3 || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })} m³</small></article>
            <article><span>Total recyclable diversion</span><strong>{kg(report.summary.recyclablesKg)}</strong></article>
            <article><span>Composting</span><strong>{kg(report.summary.compostingKg)}</strong></article>
            <article><span>Net landfill disposal</span><strong>{kg(report.summary.landfillKg)}</strong></article>
          </div>
          <JunkshopMaterialsTable rows={report.junkshopMaterials || []} kg={kg} />
          <div className="admin-stack">
            <VolumeTable title="Per-household collection" rows={report.households} labelKey="address" kg={kg} />
            <VolumeTable title="Per-truck collection" rows={report.trucks} labelKey="truckId" kg={kg} />
          </div>
          <div className="admin-actions">
            <label className="admin-filter">Export format
              <select value={format} onChange={(event) => setFormat(event.target.value)}>
                <option value="csv">CSV</option><option value="xlsx">Excel</option><option value="pdf">PDF</option>
              </select>
            </label>
            <button type="button" className="admin-button" onClick={exportReport}>Export filtered report</button>
          </div>
        </>
      )}
    </section>
  )
}

function JunkshopMaterialsTable({ rows, kg }) {
  return (
    <section>
      <h3>Junkshop monthly recyclable breakdown</h3>
      <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>Junkshop</th><th>Material</th><th>Quantity</th><th>Weight</th><th>Volume</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.accreditationNumber}-${row.category}-${row.materialName}-${row.unit}`}>
              <td>{row.junkshopName}<small>{row.accreditationNumber}</small></td>
              <td>{row.materialName}<small>{row.category.replaceAll('_', ' ')}</small></td>
              <td>{Number(row.quantity).toLocaleString()} {(row.unit === 'OTHER' ? row.otherUnit || 'other' : row.unit).toLowerCase()}</td>
              <td>{kg(row.weightKg)}</td>
              <td>{Number(row.volumeM3).toLocaleString(undefined, { maximumFractionDigits: 3 })} m³</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan="5">No junkshop recyclable records match these filters.</td></tr>}
        </tbody>
      </table></div>
    </section>
  )
}

const EMPTY_MATERIAL_ENTRY = {
  category: 'PLASTIC',
  otherMaterial: '',
  quantity: '',
  unit: 'KG',
  otherUnit: '',
  weightKg: '',
  volumeM3: '',
}

function JunkshopReporting() {
  const [month, setMonth] = useState(currentMonth)
  const [junkshops, setJunkshops] = useState([])
  const [trucks, setTrucks] = useState([])
  const [reports, setReports] = useState([])
  const [junkshopId, setJunkshopId] = useState('')
  const [truckId, setTruckId] = useState('')
  const [materials, setMaterials] = useState([{ ...EMPTY_MATERIAL_ENTRY }])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [shopData, truckData, reportData] = await Promise.all([
        authenticatedRequest('/junkshops'),
        authenticatedRequest('/trucks?limit=100'),
        authenticatedRequest('/junkshop-reports?limit=10'),
      ])
      setJunkshops(shopData.data || [])
      setTrucks(truckData.data || [])
      setReports(reportData.data || [])
      setJunkshopId((current) => current || shopData.data?.[0]?.id || '')
    } catch (requestError) {
      setError(requestError.message || 'Junkshop reporting data could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => active && refresh())
    return () => { active = false }
  }, [refresh])

  async function createJunkshop(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const body = Object.fromEntries(['name', 'accreditationNumber', 'address', 'contactPerson', 'contactNumber']
      .filter((name) => form.get(name))
      .map((name) => [name, form.get(name)]))
    try {
      const response = await authenticatedRequest('/junkshops', { method: 'POST', body })
      setJunkshopId(response.data.id)
      setNotice('Accredited junkshop saved.')
      formElement.reset()
      await refresh()
    } catch (requestError) {
      setError(requestError.message || 'The junkshop could not be saved.')
    }
  }

  function updateMaterial(index, field, value) {
    setMaterials((current) => current.map((entry, entryIndex) => entryIndex === index
      ? { ...entry, [field]: value }
      : entry))
  }

  function addMaterial() {
    setMaterials((current) => current.length < 20 ? [...current, { ...EMPTY_MATERIAL_ENTRY }] : current)
  }

  function removeMaterial(index) {
    setMaterials((current) => current.length > 1 ? current.filter((_, entryIndex) => entryIndex !== index) : current)
  }

  async function submitReport(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    const form = event.currentTarget
    const data = new FormData(form)
    const documents = data.getAll('supportingDocuments').filter((file) => file instanceof File && file.size > 0)
    if (!documents.length) {
      setSaving(false)
      setError('Attach at least one receipt or supporting document.')
      return
    }
    const body = new FormData()
    body.append('junkshopId', junkshopId)
    body.append('month', month)
    if (truckId) body.append('truckId', truckId)
    if (data.get('householdAddress')) body.append('householdAddress', data.get('householdAddress'))
    if (data.get('notes')) body.append('notes', data.get('notes'))
    body.append('materials', JSON.stringify(materials.map((entry) => ({
      category: entry.category,
      ...(entry.category === 'OTHER' ? { otherMaterial: entry.otherMaterial } : {}),
      quantity: entry.quantity,
      unit: entry.unit,
      ...(entry.unit === 'OTHER' ? { otherUnit: entry.otherUnit } : {}),
      weightKg: entry.weightKg,
      volumeM3: entry.volumeM3,
    }))))
    documents.forEach((file) => body.append('supportingDocuments', file))
    try {
      await authenticatedUpload('/junkshop-reports', body, 'POST')
      setNotice('Junkshop monthly report recorded and added to Admin Reports.')
      setMaterials([{ ...EMPTY_MATERIAL_ENTRY }])
      setTruckId('')
      form.reset()
      await refresh()
    } catch (requestError) {
      setError(requestError.message || 'The junkshop report could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function downloadDocument(attachment) {
    setError('')
    try {
      const file = await authenticatedDownload(`/attachments/${attachment.id}`)
      const url = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = url
      link.download = attachment.originalName
      link.click()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(requestError.message || 'The supporting document could not be downloaded.')
    }
  }

  const selectedJunkshop = junkshops.find((shop) => shop.id === junkshopId)

  return (
    <div className="admin-stack">
      {error && <p className="admin-message admin-message--error" role="alert">{error}</p>}
      {notice && <p className="admin-message" role="status">{notice}</p>}
      <form className="admin-form admin-form--wide" onSubmit={createJunkshop}>
        <h3>Accredited junkshop details</h3>
        <div className="admin-junkshop-grid">
          <label>Junkshop name<input name="name" required maxLength="160" /></label>
          <label>Accreditation number<input name="accreditationNumber" required maxLength="80" /></label>
          <label>Business address<input name="address" required maxLength="300" /></label>
          <label>Contact person<input name="contactPerson" maxLength="120" /></label>
          <label>Contact number<input name="contactNumber" type="tel" maxLength="24" /></label>
        </div>
        <button className="admin-button">Save junkshop details</button>
      </form>

      <form className="admin-form admin-form--wide" onSubmit={submitReport}>
        <h3>Junkshop monthly recyclables recording</h3>
        <div className="admin-junkshop-grid">
          <label>Accredited junkshop
            <select value={junkshopId} onChange={(event) => setJunkshopId(event.target.value)} required>
              <option value="">Select a junkshop</option>
              {junkshops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name} · {shop.accreditationNumber}</option>)}
            </select>
            <small>{selectedJunkshop ? `${selectedJunkshop.address}${selectedJunkshop.contactNumber ? ` · ${selectedJunkshop.contactNumber}` : ''}` : 'Register or select an active accredited junkshop.'}</small>
          </label>
          <label>Reporting month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} required /></label>
          <label>Collection truck (optional)
            <select value={truckId} onChange={(event) => setTruckId(event.target.value)}>
              <option value="">Not linked to a truck</option>
              {trucks.map((truck) => <option key={truck.id} value={truck.id}>{truck.truckId} · {truck.plateNumber}</option>)}
            </select>
          </label>
          <label>HOA / household (optional)<input name="householdAddress" maxLength="300" /></label>
        </div>
        {!junkshops.length && <p className="admin-message">Save an accredited junkshop above before submitting its monthly record.</p>}
        <div className="admin-material-entries">
          {materials.map((entry, index) => (
            <fieldset className="admin-material-row" key={index}>
              <legend>Material category {index + 1}</legend>
              <div className="admin-junkshop-grid">
                <label>Material
                  <select value={entry.category} onChange={(event) => updateMaterial(index, 'category', event.target.value)}>
                    {['PLASTIC', 'PAPER', 'METAL', 'GLASS', 'ELECTRONICS', 'BATTERY', 'TEXTILE', 'OTHER'].map((category) => <option key={category} value={category}>{category.replaceAll('_', ' ')}</option>)}
                  </select>
                </label>
                {entry.category === 'OTHER' && <label>Material description<input value={entry.otherMaterial} onChange={(event) => updateMaterial(index, 'otherMaterial', event.target.value)} required maxLength="80" /></label>}
                <label>Quantity<input type="number" min="0.01" step="0.01" value={entry.quantity} onChange={(event) => updateMaterial(index, 'quantity', event.target.value)} required /></label>
                <label>Quantity unit
                  <select value={entry.unit} onChange={(event) => updateMaterial(index, 'unit', event.target.value)}>
                    {['PIECE', 'KG', 'BAG', 'CRATE', 'OTHER'].map((unit) => <option key={unit} value={unit}>{unit.toLowerCase()}</option>)}
                  </select>
                </label>
                {entry.unit === 'OTHER' && <label>Other unit<input value={entry.otherUnit} onChange={(event) => updateMaterial(index, 'otherUnit', event.target.value)} required maxLength="20" /></label>}
                <label>Weight (kg)<input type="number" min="0.01" step="0.01" value={entry.weightKg} onChange={(event) => updateMaterial(index, 'weightKg', event.target.value)} required /></label>
                <label>Volume (m³)<input type="number" min="0" step="0.001" value={entry.volumeM3} onChange={(event) => updateMaterial(index, 'volumeM3', event.target.value)} required /></label>
              </div>
              {materials.length > 1 && <button type="button" className="admin-button admin-button--small admin-button--danger" onClick={() => removeMaterial(index)}>Remove category</button>}
            </fieldset>
          ))}
        </div>
        <div className="admin-actions">
          <button type="button" className="admin-button admin-button--small" onClick={addMaterial} disabled={materials.length >= 20}>Add material category</button>
        </div>
        <label>Notes (optional)<textarea name="notes" maxLength="1000" rows="3" /></label>
        <label>Receipts / supporting documents
          <input name="supportingDocuments" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" multiple required />
          <small>Attach 1–5 JPG, PNG, WebP, or PDF files. Maximum 8 MB each.</small>
        </label>
        <button className="admin-button" disabled={saving || !junkshops.length}>{saving ? 'Saving report…' : 'Save monthly report'}</button>
      </form>

      <section className="admin-stack" aria-labelledby="recent-junkshop-reports">
        <div className="admin-content-heading"><h3 id="recent-junkshop-reports">Recent junkshop reports</h3>{loading && <span role="status">Loading…</span>}</div>
        <div className="admin-record-list">
          {reports.map((report) => (
            <article key={report.id}>
              <div>
                <h3>{report.junkshop.name} · {report.referenceNo}</h3>
                <p>{new Date(report.reportMonth).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })} · {report.materials.length} material categories · {Number(report.materials.reduce((sum, item) => sum + Number(item.weightKg), 0)).toLocaleString()} kg</p>
                {report.truck && <small>{report.truck.truckId} · {report.truck.plateNumber}</small>}
                <div className="admin-document-links">
                  {report.attachments.map((attachment) => <button key={attachment.id} type="button" className="admin-link-button" onClick={() => downloadDocument(attachment)}>{attachment.originalName}</button>)}
                </div>
              </div>
            </article>
          ))}
          {!reports.length && !loading && <p>No junkshop reports have been recorded.</p>}
        </div>
      </section>
    </div>
  )
}

function VolumeTable({ title, rows, labelKey, kg }) {
  return (
    <section>
      <h3>{title}</h3>
      <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>{labelKey === 'address' ? 'Household address' : 'Truck'}</th><th>Total kg</th><th>Recyclables kg</th><th>Compost kg</th><th>Landfill kg</th><th>Reconciliation overage</th></tr></thead>
        <tbody>
          {rows.map((row) => <tr key={row.id || row.address || row.truckId}>
            <td>{row[labelKey]}{row.plateNumber && <small>{row.plateNumber}</small>}</td>
            <td>{kg(row.totalWasteKg)}</td><td>{kg(row.recyclablesKg)}</td><td>{kg(row.compostingKg)}</td><td>{kg(row.landfillKg)}</td>
            <td>{row.reconciliationExcessKg ? kg(row.reconciliationExcessKg) : '—'}</td>
          </tr>)}
          {!rows.length && <tr><td colSpan="6">No measured records match these filters.</td></tr>}
        </tbody>
      </table></div>
    </section>
  )
}

function Announcements({ announcements, onCreate, onUpdate, onDelete }) {
  async function submit(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const saved = await onCreate({
      title: form.get('title'),
      body: form.get('body'),
      category: form.get('category'),
      publishedAt: form.get('publish') ? new Date().toISOString() : null,
      ...(form.get('startsAt') ? { startsAt: new Date(form.get('startsAt')).toISOString() } : {}),
      ...(form.get('location') ? { location: form.get('location') } : {}),
    })
    if (saved) formElement.reset()
  }

  return (
    <div className="admin-stack">
      <form className="admin-form admin-form--wide" onSubmit={submit}>
        <label>Title<input name="title" required maxLength="160" /></label>
        <label>Content type
          <select name="category" defaultValue="ANNOUNCEMENT">
            <option value="COMMUNITY_EVENT">Community event</option>
            <option value="ACTIVITY_SCHEDULE">Activity schedule</option>
            <option value="GREETING">Greeting</option>
            <option value="ANNOUNCEMENT">Announcement</option>
            <option value="MEMO">Memo</option>
            <option value="CITY_ORDINANCE">City ordinance</option>
            <option value="BARANGAY_ORDINANCE">Barangay ordinance</option>
            <option value="RA_9003">RA 9003</option>
          </select>
        </label>
        <label>Content<textarea name="body" required maxLength="4000" rows="4" /></label>
        <label>Activity date and time<input name="startsAt" type="datetime-local" /></label>
        <label>Location<input name="location" maxLength="300" /></label>
        <label className="admin-checkbox"><input type="checkbox" name="publish" /> Publish immediately</label>
        <button className="admin-button">Create announcement</button>
      </form>
      <div className="admin-record-list">
        {announcements.map((item) => (
          <article key={item.id}>
            <div><h3>{item.title}</h3><p>{item.category?.replaceAll('_', ' ')}</p><p>{item.body}</p><small>{item.publishedAt ? `Published ${new Date(item.publishedAt).toLocaleString()}` : 'Draft'}{item.startsAt ? ` · ${new Date(item.startsAt).toLocaleString()}` : ''}{item.location ? ` · ${item.location}` : ''}</small></div>
            <div className="admin-actions">
              <button className="admin-button admin-button--small" onClick={() => onUpdate(item.id, { publishedAt: item.publishedAt ? null : new Date().toISOString() })}>{item.publishedAt ? 'Unpublish' : 'Publish'}</button>
              <button className="admin-button admin-button--small admin-button--danger" onClick={() => onDelete(item.id)}>Delete</button>
            </div>
          </article>
        ))}
        {!announcements.length && <p>No announcements yet.</p>}
      </div>
    </div>
  )
}

function UserRoleManagement({ users, currentUserId, onSave }) {
  return (
    <div className="admin-stack">
      <p className="admin-message">Assign Resident or Admin access. Super-admin accounts and your own role are protected.</p>
      <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>User account</th><th>Status</th><th>Assigned role</th><th>Created</th></tr></thead>
        <tbody>{users.map((account) => (
          <tr key={account.id}>
            <td>{account.fullName}<small>{account.email}</small></td>
            <td>{account.status}</td>
            <td>
              {account.role === 'SUPER_ADMIN' || account.id === currentUserId
                ? account.role.replaceAll('_', ' ')
                : <RoleEditor user={account} onSave={onSave} />}
            </td>
            <td>{account.createdAt ? new Date(account.createdAt).toLocaleDateString() : '—'}</td>
          </tr>
        ))}</tbody>
      </table></div>
      {!users.length && <p>No user accounts found.</p>}
    </div>
  )
}

function RoleEditor({ user, onSave }) {
  const [role, setRole] = useState(user.role)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (role === user.role) return
    setSaving(true)
    setError('')
    try {
      const saved = await onSave(user.id, role)
      if (!saved) setRole(user.role)
    } catch (saveError) {
      setError(saveError.message || 'Role could not be updated.')
      setRole(user.role)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="admin-role-form" onSubmit={submit}>
      <select value={role} onChange={(event) => setRole(event.target.value)} aria-label={`Role for ${user.fullName}`}>
        <option value="RESIDENT">Resident</option>
        <option value="ADMIN">Admin</option>
      </select>
      <button className="admin-button admin-button--small" disabled={saving || role === user.role}>{saving ? 'Saving…' : 'Save role'}</button>
      {error && <small role="alert">{error}</small>}
    </form>
  )
}
export default AdminPortal
