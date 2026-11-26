import { Link, NavLink, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { searchDirectory } from '../services/api.js'
import { authenticatedDownload } from '../services/authApi.js'
import { validateSearchQuery } from '../utils/validation.js'
import { useAuth } from '../hooks/useAuth.js'
import brandLogo from '../assets/i-WASTE-logo.svg'
import '../styles/authNav.css'

const NAV_ITEMS = [
  { label: 'Home', to: '/' },
  { label: 'Tracking', to: '/tracking' },
  { label: 'Request status', to: '/request-tracking' },
  { label: 'Services', to: '/pickup' },
  { label: 'Community', to: '/community' },
  { label: 'Reports', to: '/reports' },
  { label: 'About', to: '/about' },
]

function HeaderTools() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [error, setError] = useState('')
  const [searching, setSearching] = useState(false)

  async function submitSearch(event) {
    event.preventDefault()
    const validation = validateSearchQuery(query)
    if (!validation.valid) {
      setError(validation.error)
      setResults([])
      return
    }

    setError('')
    setSearching(true)
    try {
      setResults(await searchDirectory({ query: validation.value }))
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Search is unavailable.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="header-tools">
      <form className="search-form" role="search" onSubmit={submitSearch} noValidate>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
        <input
          aria-label="Search locations, routes, or services"
          aria-invalid={Boolean(error)}
          maxLength={65}
          placeholder="Search location, route, or service..."
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setResults([])
            setError('')
          }}
        />
        <button type="submit" aria-label="Submit search" disabled={searching}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
        </button>
        {(error || results.length > 0) && (
          <div className="search-popover" role={error ? 'alert' : 'status'}>
            {error ? <p>{error}</p> : results.map((item) => <p key={item.label}><span>{item.category}</span>{item.label}</p>)}
          </div>
        )}
      </form>
      <button type="button" className="notification-button" aria-label="Notifications">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg><i />
      </button>
    </div>
  )
}

function AuthActions({ backgroundLocation }) {
  const { user, status, logout } = useAuth()
  const userId = user?.id
  const profilePhotoAvailable = user?.profilePhotoAvailable
  const profilePhotoVersion = user?.profilePhotoVersion
  const [logoutError, setLogoutError] = useState('')
  const [photo, setPhoto] = useState(null)
  const [photoError, setPhotoError] = useState(null)

  useEffect(() => {
    if (status !== 'authenticated' || !userId || !profilePhotoAvailable) return undefined
    let active = true
    let createdUrl = ''
    authenticatedDownload('/auth/profile/photo')
      .then((file) => {
        if (!active) return
        createdUrl = URL.createObjectURL(file)
        setPhoto({ userId, url: createdUrl })
      })
      .catch((error) => {
        if (active) setPhotoError({ userId, message: error.message || 'Profile picture could not be loaded.' })
      })
    return () => {
      active = false
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [profilePhotoAvailable, profilePhotoVersion, status, userId])

  async function handleLogout() {
    setLogoutError('')
    try {
      await logout()
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : 'Unable to end your session.')
    }
  }

  if (status === 'loading') return <span className="auth-nav-loading" aria-label="Restoring session" />

  return (
    <div className="auth-nav">
      {status === 'authenticated' ? (
        <>
          <Link className="auth-nav-name" to="/profile" state={{ backgroundLocation }} title={user.fullName}>
            <span className="auth-nav-avatar" aria-hidden="true">
              {photo?.userId === user.id
                ? <img src={photo.url} alt="" />
                : user.fullName?.trim().charAt(0).toUpperCase()}
            </span>
            <span>{user.fullName}</span>
          </Link>
          <button type="button" className="auth-nav-logout" onClick={handleLogout}>Sign out</button>
        </>
      ) : (
        <>
          <Link className="auth-nav-login" to="/login" state={{ backgroundLocation }}>Sign in</Link>
          <Link className="auth-nav-register" to="/register" state={{ backgroundLocation }}>Register</Link>
        </>
      )}
      {logoutError && <span className="auth-nav-error" role="status">{logoutError}</span>}
      {photoError && photoError.userId === user?.id && <span className="auth-nav-error" role="status">{photoError.message}</span>}
    </div>
  )
}

export default function SiteNavbar({ children }) {
  const location = useLocation()
  const { pathname } = location
  const backgroundLocation = location.state?.backgroundLocation || location

  return (
    <header className="site-header">
      <div className="header-brand">
        <Link className="brand-lockup" to="/" aria-label="i-WASTE home">
          <img className="brand-image" src={brandLogo} alt="i-WASTE — Integrated Waste Access System, Tracking and Education" />
        </Link>
      </div>
      <nav className="main-nav" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => {
              const onServicePage = item.label === 'Services' && ['/pickup', '/tree-waterways', '/recyclables'].includes(pathname)
              return `nav-link${isActive || onServicePage ? ' nav-link--active' : ''}`
            }}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="site-header-actions">
        {children || <HeaderTools />}
        <AuthActions backgroundLocation={backgroundLocation} />
      </div>
    </header>
  )
}
