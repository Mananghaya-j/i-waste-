import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import ModalDialog from '../components/ModalDialog.jsx'
import SiteNavbar from '../components/SiteNavbar.jsx'
import { authenticatedDownload, authenticatedRequest, authenticatedUpload } from '../services/authApi.js'
import { useAuth } from '../hooks/useAuth.js'
import '../styles/auth.css'
import '../styles/profile.css'

function roleHome(role) {
  if (role === 'SUPER_ADMIN') return '/super-admin'
  if (role === 'ADMIN') return '/admin'
  return '/'
}

export default function ProfilePage({ modal = false }) {
  const { user, status, updateUser } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState(user?.fullName || '')
  const [contactNumber, setContactNumber] = useState(user?.contactNumber || '')
  const [photo, setPhoto] = useState(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [photoVersion, setPhotoVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const backgroundLocation = location.state?.backgroundLocation

  function closeProfile() {
    navigate(backgroundLocation || roleHome(user?.role), { replace: true })
  }

  useEffect(() => {
    if (status !== 'authenticated') return undefined
    let active = true
    authenticatedRequest('/auth/profile')
      .then(({ data }) => {
        if (!active) return
        setFullName(data.fullName)
        setContactNumber(data.contactNumber || '')
        updateUser(data)
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Unable to load your profile.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [status, updateUser])

  useEffect(() => {
    if (!user?.profilePhotoAvailable) return undefined
    let active = true
    let createdUrl = ''
    authenticatedDownload('/auth/profile/photo')
      .then((file) => {
        if (!active) return
        createdUrl = URL.createObjectURL(file)
        setPhotoUrl(createdUrl)
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Unable to load your profile picture.')
      })
    return () => {
      active = false
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [user?.profilePhotoAvailable, photoVersion])

  if (status === 'loading') {
    const loadingContent = <main className="profile-page profile-page--modal" role="status"><h1 id="profile-modal-title">Checking your account…</h1></main>
    return modal
      ? <ModalDialog titleId="profile-modal-title" onClose={closeProfile} className="app-modal--profile">{loadingContent}</ModalDialog>
      : <main className="profile-loading">Checking your account…</main>
  }
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{
      from: { pathname: '/profile' },
      backgroundLocation: backgroundLocation || { pathname: '/' },
    }} />
  }

  async function saveProfile(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setSaving(true)
    try {
      const { data } = await authenticatedRequest('/auth/profile', {
        method: 'PATCH',
        body: { fullName: fullName.trim(), contactNumber: contactNumber.trim() || null },
      })
      updateUser(data)
      setNotice('Your profile details were updated.')
    } catch (requestError) {
      setError(requestError.message || 'Unable to save your profile.')
    } finally {
      setSaving(false)
    }
  }

  async function uploadPhoto(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    if (!photo) {
      setError('Choose a JPG, PNG, or WebP image first.')
      return
    }
    setError('')
    setNotice('')
    setUploading(true)
    const body = new FormData()
    body.append('profilePhoto', photo)
    try {
      const { data } = await authenticatedUpload('/auth/profile/photo', body, 'PUT')
      updateUser(data)
      setPhoto(null)
      formElement.reset()
      setPhotoVersion((version) => version + 1)
      setNotice('Your profile picture was updated.')
    } catch (requestError) {
      setError(requestError.message || 'Unable to upload your profile picture.')
    } finally {
      setUploading(false)
    }
  }

  const initials = (fullName || user.fullName || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')

  const content = (
    <main className={`profile-page${modal ? ' profile-page--modal' : ''}`}>

      {error && <p className="profile-message profile-message--error" role="alert">{error}</p>}
      {notice && <p className="profile-message" role="status">{notice}</p>}
      {loading ? <p role="status">Loading your profile…</p> : (
        <div className="profile-grid">
          <section className="profile-card profile-card--identity">
            <div className="profile-avatar">
              {photoUrl ? <img src={photoUrl} alt={`${fullName || user.fullName}'s profile`} /> : <span>{initials}</span>}
            </div>
            <h2>{fullName || user.fullName}</h2>
            <p>{user.role.replaceAll('_', ' ')}</p>
            <form className="profile-form" onSubmit={uploadPhoto}>
              <label htmlFor="profile-photo">Profile picture</label>
              <input
                id="profile-photo"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={(event) => setPhoto(event.target.files?.[0] || null)}
              />
              <small>JPG, PNG, or WebP; maximum 5 MB.</small>
              <button className="profile-button" type="submit" disabled={uploading || !photo}>
                {uploading ? 'Uploading…' : 'Save picture'}
              </button>
            </form>
          </section>

          <section className="profile-card">
            <h2>Profile information</h2>
            <form className="profile-form" onSubmit={saveProfile}>
              <label htmlFor="profile-name">Full name</label>
              <input id="profile-name" autoComplete="name" minLength={2} maxLength={120} required value={fullName} onChange={(event) => setFullName(event.target.value)} />
              <label htmlFor="profile-email">Email address</label>
              <input id="profile-email" type="email" value={user.email} readOnly />
              <small>Email changes are not available here because they require a separate verification flow.</small>
              <label htmlFor="profile-contact">Contact number</label>
              <input id="profile-contact" type="tel" autoComplete="tel" maxLength={24} value={contactNumber} onChange={(event) => setContactNumber(event.target.value)} />
              <button className="profile-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
            </form>
          </section>
        </div>
      )}
    </main>
  )

  if (modal) {
    return <ModalDialog titleId="profile-modal-title" onClose={closeProfile} className="app-modal--profile">{content}</ModalDialog>
  }
  return <><SiteNavbar />{content}</>
}
