import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import ModalDialog from '../components/ModalDialog.jsx'
import SiteNavbar from '../components/SiteNavbar.jsx'
import { useAuth } from '../hooks/useAuth.js'
import '../styles/auth.css'

function getReturnPath(location) {
  const path = location.state?.from?.pathname || location.state?.backgroundLocation?.pathname
  return typeof path === 'string' && path.startsWith('/') &&
    !['/login', '/register', '/admin/login'].includes(path)
    ? path
    : '/'
}

function overlayState(location) {
  return { backgroundLocation: location.state?.backgroundLocation || { pathname: '/' } }
}

function AuthShell({ title, description, children, footer, eyebrow = 'i-WASTE COMMUNITY PORTAL', modal = false, onClose }) {
  const content = (
    <section className="auth-card" aria-labelledby="auth-title">
          <div className="auth-brand-mark" aria-hidden="true">iW</div>
          <p className="auth-eyebrow">{eyebrow}</p>
          <h1 id="auth-title">{title}</h1>
          <p className="auth-description">{description}</p>
          {children}
          <div className="auth-footer">{footer}</div>
    </section>
  )
  if (modal) {
    return <ModalDialog titleId="auth-title" onClose={onClose} className="app-modal--auth">{content}</ModalDialog>
  }
  return <><SiteNavbar /><main className="auth-page">{content}</main></>
}

function SessionNotice({ status, error }) {
  if (status === 'loading') return <p className="auth-session-note" role="status">Checking your saved session…</p>
  if (error) return <p className="auth-session-note auth-session-note--error" role="status">{error}</p>
  return null
}

export function LoginPage({ modal = false }) {
  return <LoginForm modal={modal} />
}

export function AdminLoginPage({ modal = false }) {
  return <LoginForm adminOnly modal={modal} />
}

function roleHome(role) {
  if (role === 'SUPER_ADMIN') return '/super-admin'
  if (role === 'ADMIN') return '/admin'
  return '/'
}

function LoginForm({ adminOnly = false, modal = false }) {
  const { login, user, status, sessionError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const modalLinkState = overlayState(location)

  function closeModal() {
    const destination = location.state?.backgroundLocation || roleHome(user?.role)
    navigate(destination, { replace: true })
  }

  if (status === 'authenticated') return <Navigate to={adminOnly && user?.role === 'RESIDENT' ? '/' : roleHome(user?.role)} replace />

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const session = await login({ email: email.trim(), password }, adminOnly)
      navigate(adminOnly ? roleHome(session.user.role) : roleHome(session.user.role) === '/' ? getReturnPath(location) : roleHome(session.user.role), { replace: true })
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title={adminOnly ? 'Administrator sign in' : 'Welcome back'}
      description={adminOnly ? 'Sign in to the i-WASTE administration portal.' : 'Sign in to your i-WASTE account.'}
      eyebrow={adminOnly ? 'i-WASTE ADMIN PORTAL' : undefined}
      modal={modal}
      onClose={closeModal}
      footer={adminOnly
        ? <>Administrative accounts only. <Link to="/login" state={modalLinkState}>Resident sign in</Link></>
        : <>New to i-WASTE? <Link to="/register" state={modalLinkState}>Create an account</Link><br /><Link to="/admin/login" state={modalLinkState}>Administrator sign in</Link></>}
    >
      <SessionNotice status={status} error={sessionError} />
      <form className="auth-form" onSubmit={submit}>
        <label htmlFor="login-email">Email address</label>
        <input
          id="login-email"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          maxLength={254}
        />
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          maxLength={128}
        />
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button type="submit" className="auth-submit" disabled={submitting || status === 'loading'}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  )
}

export function RegisterPage({ modal = false }) {
  const { register, user, status, sessionError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (status === 'authenticated') return <Navigate to={roleHome(user?.role)} replace />

  function closeModal() {
    navigate(location.state?.backgroundLocation || '/', { replace: true })
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      const details = { fullName: fullName.trim(), email: email.trim(), password }
      if (contactNumber.trim()) details.contactNumber = contactNumber.trim()
      const result = await register(details)
      setNotice(result.verificationRequired
        ? 'Your account was created. Email verification is required before sign in; email delivery is not currently configured.'
        : 'Your account was created. You can sign in now.')
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : 'Unable to create your account.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Create your account"
      description="Register as a resident to keep track of your service requests."
      modal={modal}
      onClose={closeModal}
      footer={<>Already registered? <Link to="/login" state={overlayState(location)}>Sign in</Link></>}
    >
      <SessionNotice status={status} error={sessionError} />
      <form className="auth-form" onSubmit={submit}>
        <label htmlFor="register-name">Full name</label>
        <input
          id="register-name"
          type="text"
          name="fullName"
          autoComplete="name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
          minLength={2}
          maxLength={120}
        />
        <label htmlFor="register-email">Email address</label>
        <input
          id="register-email"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          maxLength={254}
        />
        <label htmlFor="register-contact">Contact number <span>(optional)</span></label>
        <input
          id="register-contact"
          type="tel"
          name="contactNumber"
          autoComplete="tel"
          value={contactNumber}
          onChange={(event) => setContactNumber(event.target.value)}
          maxLength={24}
        />
        <label htmlFor="register-password">Password</label>
        <input
          id="register-password"
          type="password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={12}
          maxLength={128}
          aria-describedby="password-requirement"
        />
        <small id="password-requirement" className="auth-field-hint">Use at least 12 characters.</small>
        <label htmlFor="register-confirm-password">Confirm password</label>
        <input
          id="register-confirm-password"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          minLength={12}
          maxLength={128}
        />
        {error && <p className="auth-error" role="alert">{error}</p>}
        {notice && <p className="auth-session-note" role="status">{notice}</p>}
        <button type="submit" className="auth-submit" disabled={submitting || status === 'loading'}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  )
}
