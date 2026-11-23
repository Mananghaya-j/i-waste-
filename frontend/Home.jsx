import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import RouteMap from '../src/components/RouteMap.jsx'
import SiteNavbar from '../src/components/SiteNavbar.jsx'
import { getDashboardData, joinCommunityEvent, searchDirectory } from '../src/services/api.js'
import { validateSearchQuery } from '../src/utils/validation.js'

const NAV_ITEMS = [
  { label: 'Home', to: '/', icon: 'home' },
  { label: 'Tracking', to: '/tracking', icon: 'pin' },
  { label: 'Services', to: '/services', icon: 'truck' },
  { label: 'Community', to: '/community', icon: 'users' },
  { label: 'Reports', to: '/reports', icon: 'chart' },
  { label: 'About', to: '/about', icon: 'info' },
]

const MOBILE_NAV_ITEMS = NAV_ITEMS.filter((item) => item.to !== '/services' && item.to !== '/about')

// First action is the highlighted one in the design.
const QUICK_ACTIONS = [
  { icon: 'truck', label: 'Special pickup', description: 'Request waste or oil collection', to: '/pickup', featured: true },
  { icon: 'alert', label: 'Report missed collection', description: 'Tell us if your street was skipped', to: '/reports' },
  { icon: 'leaf', label: 'Tree & waterway', description: 'Request land or canal service', to: '/services' },
  { icon: 'recycle', label: 'Sell recyclables', description: 'Arrange a recyclable pickup', to: '/recyclables' },
]

// `goal` is the volunteer target that the progress bar fills toward.
const EVENTS = [
  { id: 'plaza-cleanup', name: 'Plaza Cleanup Drive', date: '2026-11-20', place: 'City Plaza', volunteers: 76, goal: 100, image: '🧹', theme: 'cleanup' },
  { id: 'river-cleanup', name: 'River Cleanup', date: '2026-11-24', place: 'Pasig River', volunteers: 53, goal: 100, image: '🌊', theme: 'river' },
  { id: 'tree-planting', name: 'Tree Planting Activity', date: '2026-11-30', place: 'Greenfield Park', volunteers: 102, goal: 150, image: '🌳', theme: 'planting' },
]

const ROUTE = { name: 'Route B-12', current: 'Rizal St.', next: 'Mabini St.', etaMinutes: 2 }

// Styles for the redesigned sections (all classes are prefixed v2-).
const HOME_STYLES = `
/* Styles for the redesigned Home page. All new classes are prefixed v2- so they
   don't collide with existing rules. Keep your existing navbar / map-panel /
   panel-heading / live-pill / legend / mobile-nav styles; they are still used. */

.dashboard-app {
  --v2-green: #0f5a3c;
  --v2-green-soft: #e0f1e6;
  --v2-track: #d3e2d9;
  --v2-ink: #10281c;
  --v2-muted: #4f6157;
  --v2-line: #dce8e0;
  --v2-bg: #eff5f1;
  --v2-card: #fff;
}

.v2-tagline {
  margin: 0;
  padding: 12px 16px 0;
  text-align: center;
  font-size: 14px;
  color: var(--v2-muted);
}

.v2-stack {
  display: flex;
  flex-direction: column;
  gap: 36px;
}

/* Each group: a heading row, then its content */
.v2-section { display: flex; flex-direction: column; gap: 14px; }
.v2-section-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; }
.v2-section-head h2 { margin: 0; font-size: 20px; font-weight: 600; color: var(--v2-ink); }
.v2-section-head p { margin: 2px 0 0; font-size: 14px; color: var(--v2-muted); }

/* ---------- Top row: tracker + route card ---------- */
.v2-top {
  display: grid;
  grid-template-columns: 1.7fr 1fr;
  gap: 20px;
  align-items: stretch;
}

.v2-route {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px;
  background: var(--v2-card);
  border: 1px solid var(--v2-line);
  border-radius: 20px;
  color: var(--v2-ink);
}

.v2-route-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.v2-route-head h2 { margin: 0; font-size: 18px; font-weight: 600; }
.v2-route-head p { margin: 2px 0 0; font-size: 13px; color: var(--v2-muted); }

.v2-eta {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 16px 18px;
  background: var(--v2-bg);
  border-radius: 14px;
}
.v2-eta p { margin: 0; font-size: 13px; color: var(--v2-muted); }
.v2-eta strong {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 56px;
  line-height: 1;
  font-weight: 700;
  color: var(--v2-green);
}
.v2-eta strong span { font-size: 20px; font-weight: 600; }
.v2-eta small { font-size: 12px; color: var(--v2-muted); }

/* Timeline */
.v2-stops { list-style: none; margin: 0; padding: 0; }
.v2-stops li { display: flex; gap: 14px; }
.v2-stops li > i {
  position: relative;
  flex: none;
  width: 16px;
  display: flex;
  justify-content: center;
}
.v2-stops li > i::before {
  content: '';
  width: 10px;
  height: 10px;
  margin-top: 4px;
  border-radius: 50%;
  border: 2px solid var(--v2-green);
  box-sizing: border-box;
  background: transparent;
  z-index: 1;
}
.v2-stops li:not(:last-child) > i::after {
  content: '';
  position: absolute;
  top: 16px;
  bottom: -2px;
  left: 50%;
  width: 2px;
  margin-left: -1px;
  background: #c5d8cc;
}
.v2-stops li.is-now > i::before { width: 14px; height: 14px; margin-top: 3px; background: var(--v2-green); }
.v2-stops li.is-now > i::after { background: var(--v2-green); }
.v2-stops li.is-last > i::before { border-color: #9bb3a4; }
.v2-stops li > div { padding-bottom: 14px; }
.v2-stops li:last-child > div { padding-bottom: 0; }
.v2-stops p { margin: 0; font-size: 15px; }
.v2-stops b { font-weight: 700; }
.v2-stops small { font-size: 12px; color: var(--v2-muted); }

/* Segmented progress */
.v2-progress { display: flex; flex-direction: column; gap: 8px; }
.v2-progress-label { display: flex; justify-content: space-between; font-size: 14px; font-weight: 600; }
.v2-segments { display: flex; gap: 5px; }
.v2-segments i { flex: 1; height: 7px; border-radius: 4px; background: var(--v2-track); }
.v2-segments i.is-done { background: var(--v2-green); }

/* Notify row */
.v2-notify {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding: 0 16px;
  border: 1px solid var(--v2-line);
  border-radius: 12px;
  background: var(--v2-card);
  color: var(--v2-ink);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}
.v2-notify svg { color: var(--v2-green); flex: none; }
.v2-notify span { flex: 1; }
.v2-notify b { font-size: 13px; font-weight: 600; color: var(--v2-green); }
.v2-notify[aria-pressed='true'] { background: var(--v2-green-soft); border-color: var(--v2-green); }

.v2-route-actions { display: flex; gap: 12px; margin-top: auto; }

/* Buttons shared by route card and drives */
.v2-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0 24px;
  border: 2px solid var(--v2-green);
  border-radius: 12px;
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  box-sizing: border-box;
}
.v2-route-actions .v2-btn { flex: 1; padding: 0 12px; }
.v2-btn--solid { background: var(--v2-green); color: #fff; }
.v2-btn--outline { background: var(--v2-card); color: var(--v2-green); }
.v2-btn:disabled { opacity: 0.6; cursor: progress; }

/* ---------- Status pills (live tracker) ---------- */
.map-panel > .panel-heading { min-height: 56px; }
.v2-legend { display: flex; flex-wrap: wrap; gap: 10px; margin: 0; padding: 14px 12px 16px; list-style: none; }
.v2-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 14px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}
.v2-pill i { flex: none; width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.v2-pill--active { color: #0f5a3c; background: #e0f1e6; }
.v2-pill--delayed { color: #6b4a00; background: #fdf0cc; }
.v2-pill--maintenance { color: #8a1c1c; background: #fbe0e0; }
.v2-pill--live { padding: 7px 14px; font-size: 13px; font-weight: 600; color: #0f5a3c; background: #e0f1e6; }
.v2-pill--live i { background: #22a85a; box-shadow: 0 0 0 3px rgba(34, 168, 90, .22); }

/* ---------- Quick actions ---------- */
.v2-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}
.v2-action {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 88px;
  padding: 16px 18px;
  box-sizing: border-box;
  background: var(--v2-card);
  border: 1px solid var(--v2-line);
  border-radius: 20px;
  color: var(--v2-ink);
  text-decoration: none;
  transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease;
}
.v2-action:hover { border-color: #83bd78; box-shadow: 0 8px 20px rgba(15, 90, 60, .12); transform: translateY(-2px); }
.v2-action-icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: var(--v2-green-soft);
  color: var(--v2-green);
}
.v2-action-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.v2-action-copy strong { font-size: 16px; font-weight: 600; line-height: 1.25; }
.v2-action-copy span { font-size: 14px; line-height: 1.35; color: var(--v2-muted); }
.v2-action-go {
  flex: none;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--v2-bg);
  color: var(--v2-green);
  transition: transform .18s ease, background .18s ease, color .18s ease;
}
.v2-action:hover .v2-action-go { background: var(--v2-green); color: #fff; transform: translateX(3px); }
.v2-action--featured { background: var(--v2-green); border-color: var(--v2-green); color: #fff; }
.v2-action--featured:hover { border-color: var(--v2-green); box-shadow: 0 8px 20px rgba(15, 90, 60, .32); }
.v2-action--featured .v2-action-icon { background: rgba(255, 255, 255, .16); color: #fff; }
.v2-action--featured .v2-action-copy span { color: #fff; }
.v2-action--featured .v2-action-go { background: rgba(255, 255, 255, .18); color: #fff; }
.v2-action--featured:hover .v2-action-go { background: #fff; color: var(--v2-green); }

/* ---------- Stats ---------- */
.v2-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}
.v2-stat {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px 24px;
  background: var(--v2-card);
  border: 1px solid var(--v2-line);
  border-radius: 20px;
  color: var(--v2-ink);
}
.v2-stat-icon,
.v2-ring { flex: none; width: 72px; height: 72px; }
.v2-stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--v2-green-soft);
  color: var(--v2-green);
}
.v2-ring circle { fill: none; stroke-width: 8; }
.v2-ring-track { stroke: var(--v2-track); }
.v2-ring-fill { stroke: var(--v2-green); stroke-linecap: round; }
.v2-stat-copy { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.v2-stat-copy p {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--v2-muted);
}
.v2-stat-copy strong { font-size: 36px; font-weight: 700; line-height: 1.1; }
.v2-stat-copy strong small { font-size: 16px; font-weight: 500; color: var(--v2-muted); }
.v2-stat-copy span { font-size: 14px; color: var(--v2-muted); }

/* ---------- Clean-up drives ---------- */
.v2-drives {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 28px 32px;
  background: var(--v2-card);
  border: 1px solid var(--v2-line);
  border-radius: 20px;
  color: var(--v2-ink);
}
.v2-drives-head { display: flex; justify-content: space-between; align-items: center; }
.v2-drives-head h2 { margin: 0; font-size: 24px; font-weight: 600; }
.v2-link { color: var(--v2-green); font-weight: 600; text-decoration: none; }

.v2-drive-list { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.v2-drive {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 18px 24px;
  border: 1px solid var(--v2-line);
  border-radius: 16px;
}
.v2-date {
  flex: none;
  width: 72px;
  height: 72px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: var(--v2-green-soft);
  color: var(--v2-green);
}
.v2-date strong { font-size: 32px; font-weight: 700; line-height: 1; }
.v2-date span { font-size: 14px; font-weight: 600; }
.v2-drive-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.v2-drive-info > strong { font-size: 20px; font-weight: 600; }
.v2-drive-info > span { font-size: 15px; color: var(--v2-muted); }
.v2-drive-meter { align-self: stretch; margin-top: 6px; }
.v2-drive-meter-label { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; font-weight: 600; }
.v2-bar { height: 8px; margin-top: 6px; border-radius: 4px; background: var(--v2-track); overflow: hidden; }
.v2-bar i { display: block; height: 100%; border-radius: 4px; background: var(--v2-green); transition: width 0.3s ease; }

/* Event card body: info on the left, Join button on the right */
.v2-event-body { display: flex; flex-direction: column; justify-content: center; min-width: 0; }
.v2-event-body .event-info { min-width: 0; padding-bottom: 6px; }
.v2-event-body .v2-join { align-self: flex-start; margin: 0 0 12px 12px; }

/* ---------- Focus & motion ---------- */
.v2-btn:focus-visible,
.v2-action:focus-visible,
.v2-notify:focus-visible,
.v2-link:focus-visible { outline: 3px solid #1f9d63; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .v2-bar i, .v2-action, .v2-action-go { transition: none; } .v2-action:hover { transform: none; } .v2-action:hover .v2-action-go { transform: none; } }

/* ---------- Responsive ---------- */
@media (max-width: 1100px) {
  .v2-top { grid-template-columns: 1fr; }
  .v2-actions, .v2-stats { grid-template-columns: repeat(2, 1fr); }
  .v2-drive-list { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .v2-actions, .v2-stats { grid-template-columns: 1fr; }
  .v2-drives { padding: 20px 16px; }
  .v2-drive { flex-wrap: wrap; padding: 16px; }
  .v2-drive-info { flex-basis: calc(100% - 92px); }
  .v2-drive > .v2-btn { width: 100%; }
}
`

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
    case 'leaf': return <svg {...props}><path d="M20 4C10 4 5 8 5 14a6 6 0 0 0 6 6c6 0 9-8 9-16Z" /><path d="M4 21c3-6 7-9 13-13" /></svg>
    case 'alert': return <svg {...props}><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17h.01" /></svg>
    case 'users': return <svg {...props}><circle cx="9" cy="8" r="3" /><path d="M3 20v-1a6 6 0 0 1 12 0v1zM16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v1h-3" /></svg>
    case 'chart': return <svg {...props}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
    case 'info': return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
    case 'search': return <svg {...props}><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
    case 'bell': return <svg {...props}><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
    case 'recycle': return <svg {...props}><path d="M20 12a8 8 0 0 0-14-5.3L4 9M4 4v5h5" /><path d="M4 12a8 8 0 0 0 14 5.3L20 15M20 20v-5h-5" /></svg>
    case 'clipboard': return <svg {...props}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 13l2 2 4-4" /></svg>
    case 'pin': return <svg {...props}><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>
    case 'arrow': return <svg {...props}><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
    default: return null
  }
}

function Ring({ percent }) {
  const circumference = 2 * Math.PI * 30
  const filled = (Math.max(0, Math.min(100, percent)) / 100) * circumference
  return (
    <svg className="v2-ring" width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
      <circle cx="36" cy="36" r="30" className="v2-ring-track" />
      <circle
        cx="36" cy="36" r="30" className="v2-ring-fill"
        strokeDasharray={`${filled} ${circumference}`}
        transform="rotate(-90 36 36)"
      />
    </svg>
  )
}

// Icon (or progress ring) sits beside the label, number and optional trend line.
function MetricCard({ icon, label, value, unit, trend, ringPercent }) {
  return (
    <article className="v2-stat">
      {ringPercent !== undefined
        ? <Ring percent={ringPercent} />
        : <span className="v2-stat-icon"><Icon name={icon} size={30} /></span>}
      <div className="v2-stat-copy">
        <p>{label}</p>
        <strong>{value}{unit && <small>{unit}</small>}</strong>
        {trend && <span>▲ {trend}</span>}
      </div>
    </article>
  )
}

function formatDate(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
  const [notifyOn, setNotifyOn] = useState(false)
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

  const streetsTotal = dashboard?.streetsTotal ?? 6
  const streetsDone = dashboard?.streetsCompleted ?? 0
  const trucksPercent = dashboard && dashboard.totalTrucks
    ? (dashboard.activeTrucks / dashboard.totalTrucks) * 100
    : 0

  return (
    <div className="dashboard-app">
      <style>{HOME_STYLES}</style>
      <SiteNavbar>
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
      </SiteNavbar>

      <div className="dashboard-grid">
        <main className="dashboard-main v2-stack">
          {loadError && <p className="dashboard-error" role="alert">Dashboard update failed: {loadError}</p>}

          {/* Tracker + route card */}
          <section className="v2-section" aria-label="Live tracking">
            <div className="v2-top">
            <article className="panel map-panel" id="tracking">
              <div className="panel-heading">
                <h2>Live collection tracker</h2>
                <span className="v2-pill v2-pill--live"><i aria-hidden="true" />Live · updated {updatedTime}</span>
              </div>
              <div className="map-window"><RouteMap /></div>
              <ul className="v2-legend" aria-label="Route status key">
                <li className="v2-pill v2-pill--active"><i aria-hidden="true" />Active route</li>
                <li className="v2-pill v2-pill--delayed"><i aria-hidden="true" />Delayed</li>
                <li className="v2-pill v2-pill--maintenance"><i aria-hidden="true" />Maintenance</li>
              </ul>
            </article>

            <article className="v2-route" aria-label={`${ROUTE.name} status`}>
              <header className="v2-route-head">
                <div>
                  <h2>{ROUTE.name}</h2>
                  <p>Truck B-12 · Barangay Bagong Silangan</p>
                </div>
                <span className="active-pill">Active</span>
              </header>

              <div className="v2-eta">
                <div>
                  <p>Arriving at {ROUTE.next} in</p>
                  <strong>{ROUTE.etaMinutes}<span>min</span></strong>
                </div>
                <small>Updated {updatedTime}</small>
              </div>

              <ol className="v2-stops">
                <li className="is-now">
                  <i aria-hidden="true" />
                  <div><p><b>Now</b> · {ROUTE.current}</p><small>Collecting</small></div>
                </li>
                <li className="is-next">
                  <i aria-hidden="true" />
                  <div><p><b>Next</b> · {ROUTE.next}</p><small>About {ROUTE.etaMinutes} min away</small></div>
                </li>
                <li className="is-last">
                  <i aria-hidden="true" />
                  <div>
                    <p><b>Last</b> · {dashboard?.finalStop ?? '—'}</p>
                    <small>Estimated finish: {dashboard?.estimatedFinish ?? '—'}</small>
                  </div>
                </li>
              </ol>

              <div className="v2-progress">
                <div className="v2-progress-label">
                  <span>Collection progress</span>
                  <span>{streetsDone} of {streetsTotal} streets</span>
                </div>
                <div
                  className="v2-segments"
                  role="progressbar"
                  aria-label="Collection progress"
                  aria-valuemin={0}
                  aria-valuemax={streetsTotal}
                  aria-valuenow={streetsDone}
                >
                  {Array.from({ length: streetsTotal }, (_, index) => (
                    <i key={index} className={index < streetsDone ? 'is-done' : ''} />
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="v2-notify"
                aria-pressed={notifyOn}
                onClick={() => setNotifyOn((current) => !current)}
              >
                <Icon name="bell" size={18} />
                <span>Notify me when it's near my street</span>
                <b>{notifyOn ? 'On' : 'Turn on'}</b>
              </button>

              <div className="v2-route-actions">
                <Link className="v2-btn v2-btn--solid" to="/tracking">Full-screen map</Link>
                <Link className="v2-btn v2-btn--outline" to="/tracking">Route details</Link>
              </div>
            </article>
          </div>
          </section>

          {/* Quick actions */}
          <section className="v2-section" aria-labelledby="sec-actions">
            <header className="v2-section-head">
              <div>
                <h2 id="sec-actions">Quick actions</h2>
              </div>
            </header>
            <div className="v2-actions">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.label}
                to={action.to}
                className={`v2-action${action.featured ? ' v2-action--featured' : ''}`}
              >
                <span className="v2-action-icon"><Icon name={action.icon} size={22} /></span>
                <span className="v2-action-copy">
                  <strong>{action.label}</strong>
                  <span>{action.description}</span>
                </span>
                <span className="v2-action-go" aria-hidden="true"><Icon name="arrow" size={16} /></span>
              </Link>
            ))}
          </div>
          </section>

          {/* Stats */}
          <section className="v2-section" aria-labelledby="sec-overview">
            <header className="v2-section-head">
              <div>
                <h2 id="sec-overview">Today’s overview</h2>
              </div>
            </header>
            <div className="v2-stats">
            <MetricCard
              label="Active trucks"
              value={dashboard ? String(dashboard.activeTrucks) : '—'}
              unit={dashboard ? ` of ${dashboard.totalTrucks}` : ''}
              ringPercent={trucksPercent}
            />
            <MetricCard
              icon="clipboard"
              label="Collections today"
              value={dashboard?.collectionsToday ?? '—'}
              unit=" stops"
              trend={dashboard?.collectionsChangePct != null ? `${dashboard.collectionsChangePct}% vs yesterday` : undefined}
            />
            <MetricCard
              icon="recycle"
              label="Waste recycled"
              value={dashboard ? String(dashboard.wasteRecycledTons) : '—'}
              unit=" tons"
              trend={dashboard?.recycledChangePct != null ? `${dashboard.recycledChangePct}% this week` : undefined}
            />
            <MetricCard
              icon="users"
              label="Community members"
              value={dashboard ? dashboard.communityMembers.toLocaleString() : '—'}
              trend={dashboard?.newMembersThisWeek != null ? `${dashboard.newMembersThisWeek} new this week` : undefined}
            />
          </div>
          </section>

          {/* Clean-up drives */}
          <section className="v2-section" id="community" aria-labelledby="sec-community">
            <header className="v2-section-head">
              <div>
                <h2 id="sec-community">Upcoming clean-up drives</h2>
              </div>
              <Link to="/community" className="v2-link">See all →</Link>
            </header>
            <article className="v2-drives">
<div className="event-list">
              {EVENTS.map((event) => {
                const joined = joinedEvents.includes(event.id)
                const count = event.volunteers + (joined ? 1 : 0)
                const percent = Math.min(100, Math.round((count / event.goal) * 100))
                return (
                  <div className="event-card" key={event.id}>
                    <div className={`event-art event-art--${event.theme}`} aria-hidden="true"><span>{event.image}</span><i /><i /><i /></div>
                    <div className="v2-event-body">
                    <div className="event-info">
                      <strong>{event.name}</strong>
                      <span><Icon name="calendar" size={12} />{formatDate(event.date)}</span>
                      <span><Icon name="pin" size={12} />{event.place}</span>
                      <div className="v2-drive-meter">
                        <div className="v2-drive-meter-label">
                          <span>{count} of {event.goal} volunteers joined</span>
                          <span>{percent}%</span>
                        </div>
                        <div
                          className="v2-bar"
                          role="progressbar"
                          aria-label={`${event.name} volunteers joined`}
                          aria-valuemin={0}
                          aria-valuemax={event.goal}
                          aria-valuenow={count}
                        >
                          <i style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    </div>
                    <button type="button" className={`${joined ? 'joined-button' : 'event-button'} v2-join`} disabled={joiningEvent === event.id} onClick={() => joinEvent(event.id)}>
                      {joiningEvent === event.id ? 'Joining…' : joined ? 'Joined ✓' : 'Join Event'}
                    </button>
                  </div>
                  </div>
                )
              })}
            </div>
            {eventError && <p className="inline-error" role="alert">{eventError}</p>}
          </article>
          </section>
        </main>
      </div>

      <footer className="dashboard-footer" id="about">
        Integrated Waste Access System, Tracking &amp; Education <span aria-hidden="true">·</span> Barangay Bagong Silangan
      </footer>

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
          to="/services"
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
