import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import SiteNavbar from '../components/SiteNavbar.jsx'
import { useAuth } from '../context/useAuth.js'
import './auth.css'

function getReturnPath(location) {
  const path = location.state?.from?.pathname
  return typeof path === 'string' && path.startsWith('/') && !['/login', '/register'].includes(path) ? path : '/'
}

function AuthShell({ title, description, children, footer }) {
  return (
    <>
      <SiteNavbar />
      <main className="auth-page">
        <section className="auth-card" aria-labelledby="auth-title">
          <div className="auth-brand-mark" aria-hidden="true">iW</div>
          <p className="auth-eyebrow">i-WASTE COMMUNITY PORTAL</p>
          <h1 id="auth-title">{title}</h1>
          <p className="auth-description">{description}</p>
          {children}
          <div className="auth-footer">{footer}</div>
        </section>
      </main>
    </>
  )
}

function SessionNotice({ status, error }) {
  if (status === 'loading') return <p className="auth-session-note" role="status">Checking your saved session…</p>
  if (error) return <p className="auth-session-note auth-session-note--error" role="status">{error}</p>
  return null
}

export function LoginPage() {
  const { login, status, sessionError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (status === 'authenticated') return <Navigate to="/" replace />

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login({ email: email.trim(), password })
      navigate(getReturnPath(location), { replace: true })
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to your i-WASTE account."
      footer={<>New to i-WASTE? <Link to="/register">Create an account</Link></>}
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

export function RegisterPage() {
  const { register, status, sessionError } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (status === 'authenticated') return <Navigate to="/" replace />

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
      await register(details)
      navigate('/', { replace: true })
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
      footer={<>Already registered? <Link to="/login">Sign in</Link></>}
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
        <button type="submit" className="auth-submit" disabled={submitting || status === 'loading'}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  )
}
