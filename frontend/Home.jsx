import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import RouteMap from '../src/components/RouteMap.jsx'
import { getDashboardData, joinCommunityEvent, searchDirectory } from '../src/services/api.js'
import { validateSearchQuery } from '../src/utils/validation.js'

const NAV_ITEMS = [
  { label: 'Home', to: '/', icon: 'home' },
  { label: 'Tracking', to: '/tracking', icon: 'pin' },
  { label: 'Services', to: '/pickup', icon: 'truck' },
  { label: 'Community', to: '/community', icon: 'users' },
  { label: 'Reports', to: '/reports', icon: 'chart' },
  { label: 'About', to: '/about', icon: 'info' },
]

const MOBILE_NAV_ITEMS = NAV_ITEMS.filter((item) => item.to !== '/pickup' && item.to !== '/about')

const QUICK_ACTIONS = [
  { label: 'Track collection', description: 'Find your truck on the map', icon: 'pin', to: '/tracking' },
  { label: 'Special pickup', description: 'Request waste or oil collection', icon: 'truck', to: '/pickup' },
  { label: 'Tree & waterway', description: 'Request land or canal service', icon: 'leaf', to: '/tree-waterways' },
  { label: 'Sell recyclables', description: 'Arrange a recyclable pickup', icon: 'recycle', to: '/recyclables' },
]

const EVENTS = [
  { id: 'plaza-cleanup', name: 'Plaza Cleanup Drive', date: 'Nov 20, 2026', place: 'City Plaza', volunteers: 76, image: '🧹', theme: 'cleanup' },
  { id: 'river-cleanup', name: 'River Cleanup', date: 'Nov 24, 2026', place: 'Pasig River', volunteers: 53, image: '🌊', theme: 'river' },
  { id: 'tree-planting', name: 'Tree Planting Activity', date: 'Nov 30, 2026', place: 'Greenfield Park', volunteers: 102, image: '🌳', theme: 'planting' },
]

function Icon({ name, size = 18 }) {
  const props = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round',
    strokeLinejoin: 'round', 'aria-hidden': true,
  }
  switch (name) {
    case 'home': return <svg {...props}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></svg>
    case 'truck': return <svg {...props}><path d="M2 6h12v11H2zM14 10h4l4 4v3h-8" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></svg>
    case 'calendar': return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h2M14 14h2M8 17h2" /></svg>
    case 'users': return <svg {...props}><circle cx="9" cy="8" r="3" /><path d="M3 20v-1a6 6 0 0 1 12 0v1zM16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v1h-3" /></svg>
    case 'chart': return <svg {...props}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
    case 'info': return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
    case 'search': return <svg {...props}><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
    case 'bell': return <svg {...props}><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
    case 'leaf': return <svg {...props}><path d="M20 4C10 4 5 8 5 14a6 6 0 0 0 6 6c6 0 9-8 9-16Z" /><path d="M4 21c3-6 7-9 13-13" /></svg>
    case 'recycle': return <svg {...props}><path d="m7 7 2-3h5l2 3M5 10l-2 4 3 4h4m9-8 2 4-3 4h-4m-5-3 3-5 3 5m-8 0h5" /></svg>
    case 'pin': return <svg {...props}><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>
    case 'arrow': return <svg {...props}><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
    case 'check': return <svg {...props}><path d="m5 12 4 4L19 6" /></svg>
    case 'clock': return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
    default: return null
  }
}

function MetricCard({ icon, label, value, note, variant }) {
  return (
    <article className="metric-card">
      <span className={`metric-icon ${variant}`}><Icon name={icon} size={22} /></span>
      <div className="metric-copy">
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{note}</span>
      </div>
    </article>
  )
}


export default function Home() {
  const [dashboard, setDashboard] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [searchError, setSearchError] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [joinedEvents, setJoinedEvents] = useState([])
  const [joiningEvent, setJoiningEvent] = useState('')
  const [eventError, setEventError] = useState('')
  const location = useLocation()

  useEffect(() => {
    let active = true
    async function refreshDashboard() {
      try {
        const snapshot = await getDashboardData()
        if (active) {
          setDashboard(snapshot)
          setLoadError('')
        }
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : 'Dashboard data is unavailable.')
      }
    }

    refreshDashboard()
    const timer = window.setInterval(refreshDashboard, 30000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    const targetIds = {
      '/tracking': 'tracking',
      '/community': 'community',
      '/reports': 'reports',
      '/about': 'about',
    }
    const targetId = targetIds[location.pathname]
    if (!targetId) return undefined

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [location.pathname])

  async function submitSearch(event) {
    event.preventDefault()
    const validation = validateSearchQuery(search)
    if (!validation.valid) {
      setSearchError(validation.error)
      setSearchResults([])
      return
    }
    setSearch(validation.value)
    setSearchError('')
    setSearching(true)
    try {
      setSearchResults(await searchDirectory({ query: validation.value }))
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Search is unavailable.')
    } finally {
      setSearching(false)
    }
  }

  async function joinEvent(eventId) {
    setJoiningEvent(eventId)
    setEventError('')
    try {
      await joinCommunityEvent({ eventId })
      setJoinedEvents((current) => current.includes(eventId) ? current : [...current, eventId])
    } catch (error) {
      setEventError(error instanceof Error ? error.message : 'Could not join this event.')
    } finally {
      setJoiningEvent('')
    }
  }

  const updatedTime = dashboard
    ? new Date(dashboard.lastUpdated).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '…'

  return (
    <div className="dashboard-app">
      <header className="site-header">
        <div className="header-brand">
          <Link className="brand-lockup" to="/" aria-label="i-WASTE home">
            <span className="brand-mark"><Icon name="recycle" size={29} /></span>
            <span className="brand-type"><strong>i-WASTE</strong><small>Integrated Waste Access System, Tracking & Education</small></span>
          </Link>
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="header-tools">
          <form className="search-form" role="search" onSubmit={submitSearch} noValidate>
            <Icon name="search" size={17} />
            <input
              aria-label="Search locations, routes, or services"
              aria-invalid={Boolean(searchError)}
              aria-describedby={searchError ? 'search-feedback' : undefined}
              maxLength={65}
              placeholder="Search location, route, or service..."
              value={search}
              onChange={(event) => {
                const nextValue = event.target.value
                setSearch(nextValue)
                setSearchResults([])
                const result = validateSearchQuery(nextValue)
                setSearchError(result.valid ? '' : result.error)
              }}
            />
            <button type="submit" aria-label="Submit search" disabled={searching}><Icon name="arrow" size={16} /></button>
            {(searchError || searchResults.length > 0) && (
              <div className="search-popover" id="search-feedback" role={searchError ? 'alert' : 'status'}>
                {searchError ? <p>{searchError}</p> : searchResults.length
                  ? searchResults.map((item) => <p key={item.label}><span>{item.category}</span>{item.label}</p>)
                  : <p>No matching services or routes.</p>}
              </div>
            )}
          </form>
          <button type="button" className="notification-button" aria-label="Notifications"><Icon name="bell" size={20} /><i /></button>
        </div>
      </header>

      <div className="dashboard-grid">
        <main className="dashboard-main">


          <section className="collection-status-card" aria-label="Today's collection status">
            <span className="collection-status-icon"><Icon name="truck" size={22} /></span>
            <div className="collection-status-copy">
              <span className="status-caption">TODAY'S COLLECTION</span>
              <strong className={dashboard?.activeTrucks > 0 ? 'collection-status-active' : ''}>
                <i />
                {dashboard
                  ? dashboard.activeTrucks > 0 ? 'Collection in progress' : 'No trucks currently active'
                  : 'Checking live status'}
              </strong>
              <p>Route B-12 <span>·</span> Next stop Mabini St. <span>·</span> ETA 2 mins</p>
            </div>
            <Link className="track-live-button" to="/tracking">
              <Icon name="pin" size={15} /> Track live <Icon name="arrow" size={14} />
            </Link>
          </section>




          {loadError && <p className="dashboard-error" role="alert">Dashboard update failed: {loadError}</p>}

          <section className="dashboard-panels" aria-label="Waste collection dashboard">
            <article className="panel map-panel" id="tracking">
              <div className="panel-heading">
                <h2><Icon name="leaf" size={18} /> LIVE COLLECTION TRACKER</h2>
                <span className="live-pill"><i /> Live</span>
              </div>
              <div className="map-window"><RouteMap /></div>
              <div className="map-legend"><span><i className="legend-active" /> Active Route</span><span><i className="legend-delayed" /> Delayed</span><span><i className="legend-maintenance" /> Maintenance</span><small>Updated {updatedTime}</small></div>
            </article>
           <div className="route-column">
              <article className="panel route-panel">
                <div className="panel-heading"><h2>Current Route</h2><Link to="/tracking" className="text-link">View Details ›</Link></div>
                <div className="route-title"><span className="round-icon"><Icon name="truck" size={19} /></span><strong>Route B-12</strong><span className="active-pill">Active</span></div>
                <ul className="route-stops">
                  <li className="stop-current"><i />Now: Rizal St.</li>
                  <li><i />Next Stop: Mabini St.</li>
                  <li><i />ETA: 2 mins</li>
                </ul>
              </article>
              <article className="panel progress-panel">
                <h2>Collection Progress</h2>
                <div className="progress-value"><strong>{dashboard?.routeProgress ?? '—'}%</strong><span>{dashboard?.streetsCompleted ?? '—'} of {dashboard?.streetsTotal ?? '—'} streets</span></div>
                <div className="progress-track"><i style={{ width: `${dashboard?.routeProgress ?? 0}%` }} /></div>
                <p>{dashboard?.streetsCompleted ?? '—'} of {dashboard?.streetsTotal ?? '—'} streets completed</p>
              </article>
              <article className="panel statistics-panel">
                  <section className="metric-grid" aria-label="Community collection overview">
                    <MetricCard icon="truck" label="Active Trucks" value={dashboard ? `${dashboard.activeTrucks}` : '—'} note={dashboard ? `/ ${dashboard.totalTrucks} total` : 'Loading'} variant="lime" />
                    <MetricCard icon="recycle" label="Collections Today" value={dashboard?.collectionsToday ?? '—'} note="stops" variant="green" />
                    <MetricCard icon="leaf" label="Waste Recycled" value={dashboard ? `${dashboard.wasteRecycledTons} Tons` : '—'} note="and counting" variant="leaf" />
                    <MetricCard icon="users" label="Community Members" value={dashboard ? dashboard.communityMembers.toLocaleString() : '—'} note="and growing" variant="people" />
                  </section>
              </article>
            </div>
           
       
          </section>


               <article className="panel events-panel" id="community">
              <div className="panel-heading"><h2>Upcoming Clean-Up Drives</h2><Link to="/community" className="text-link">See All ›</Link></div>
              <div className="event-list">
                {EVENTS.map((event) => {
                  const joined = joinedEvents.includes(event.id)
                  return (
                    <div className="event-card" key={event.id}>
                      <div className={`event-art event-art--${event.theme}`} aria-hidden="true"><span>{event.image}</span><i /><i /><i /></div>
                      <div className="event-info"><strong>{event.name}</strong><span><Icon name="calendar" size={12} />{event.date}</span><span><Icon name="pin" size={12} />{event.place}</span><span><Icon name="users" size={12} />{event.volunteers} volunteers</span><button type="button" className={joined ? 'joined-button' : 'event-button'} disabled={joiningEvent === event.id} onClick={() => joinEvent(event.id)}>{joiningEvent === event.id ? 'Joining…' : joined ? 'Joined ✓' : 'Join Event'}</button></div>
                    </div>
                  )
                })}
              </div>
              {eventError && <p className="inline-error" role="alert">{eventError}</p>}
              <div className="community-callout"><Icon name="leaf" size={34} /><span>“Small actions make<br />a big, green difference.”</span></div>
            </article>
          <section className="resident-quick-actions" aria-labelledby="quick-actions-title">
                      <div className="quick-actions-heading">
                        <div>
                          <h2 id="quick-actions-title">Quick actions</h2>
                          <p>What would you like to do?</p>
                        </div>
                      </div>
                      <div className="quick-actions-grid">
                        {QUICK_ACTIONS.map((action) => {
                          const content = (
                            <>
                              <span className={`quick-action-icon quick-action-icon--${action.icon}`}>
                                <Icon name={action.icon} size={19} />
                              </span>
                              <span className="quick-action-copy">
                                <strong>{action.label}</strong>
                                <small>{action.description}</small>
                              </span>
                              <Icon name="arrow" size={15} />
                            </>
                          )

                          return <Link className="quick-action-card" key={action.label} to={action.to}>{content}</Link>
                        })}
                      </div>
          </section>      
             
          <footer className="dashboard-footer" id="about">Integrated Waste Access System, Tracking &amp; Education <span>·</span> Barangay Bagong Silang</footer>
        </main>
      </div>

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {MOBILE_NAV_ITEMS.slice(0, 2).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `mobile-nav-link${isActive ? ' mobile-nav-link--active' : ''}`}
          >
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <Link
          className="mobile-nav-action"
          to="/pickup"
          aria-label="Open resident services"
        >
          <span className="mobile-nav-action-plus" aria-hidden="true">+</span>
          <span>Services</span>
        </Link>
        {MOBILE_NAV_ITEMS.slice(2).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `mobile-nav-link${isActive ? ' mobile-nav-link--active' : ''}`}
          >
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

    </div>
  )
}
