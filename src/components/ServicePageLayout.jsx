import { Link, NavLink } from 'react-router-dom'

const SERVICE_MODULES = [
  { label: 'Waste & oil pickup', to: '/pickup' },
  { label: 'Tree & waterway', to: '/tree-waterways' },
  { label: 'Sell recyclables', to: '/recyclables' },
]

const REQUEST_STATUSES = ['Submitted', 'Under Review', 'Scheduled', 'In Progress', 'Completed']

export default function ServicePageLayout({ module, title, description, children }) {
  return (
    <div className="service-app">
      <header className="service-site-header">
        <Link className="service-brand" to="/">
          <span aria-hidden="true">♻</span>
          <strong>i-WASTE</strong>
        </Link>
        <Link className="service-home-link" to="/">Back to resident home</Link>
      </header>
      <main className="service-main">
        <section className="service-intro">
          <p className="service-overline">
            RESIDENT ENVIRONMENTAL SERVICES{module && <> <span>·</span> {module}</>}
          </p>
          <h1>{title}</h1>
          <p>{description}</p>
        </section>
        <nav className="service-module-tabs" aria-label="Resident services">
          {SERVICE_MODULES.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `service-module-tab${isActive ? ' service-module-tab--active' : ''}`}
            >
              <strong>{item.label}</strong>
            </NavLink>
          ))}
        </nav>
        <div className="service-page-content">{children}</div>
      </main>
    </div>
  )
}

export function FileUpload({ id, label, accept = 'image/jpeg,image/png,image/webp', multiple = false, required = false, value, help, onChange }) {
  const files = Array.isArray(value) ? value : value ? [value] : []

  return (
    <label className="service-field service-upload-field" htmlFor={id}>
      <span>{label}{required && <i>Required</i>}</span>
      <input
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        required={required}
        onChange={(event) => {
          const selected = Array.from(event.target.files || [])
          onChange(multiple ? selected : selected[0] || null)
        }}
      />
      <small>
        {files.length ? files.map((file) => file.name).join(', ') : help}
      </small>
    </label>
  )
}

export function ServiceSuccess({ request, title, detail, onReset }) {
  return (
    <section className="service-success" role="status" aria-live="polite">
      <span className="service-success-mark" aria-hidden="true">✓</span>
      <p className="service-overline">REQUEST RECEIVED</p>
      <h2>{title}</h2>
      <p>{detail}</p>
      <div className="service-ticket">
        <div>
          <span>Request reference</span>
          <strong>{request.reference}</strong>
        </div>
        <span className="service-status-pill">{request.status}</span>
      </div>
      <ol className="request-status-steps" aria-label="Request status">
        {REQUEST_STATUSES.map((status, index) => (
          <li className={index === 0 ? 'request-status-step--current' : ''} key={status} aria-current={index === 0 ? 'step' : undefined}>
            <i />
            <span>{status}</span>
          </li>
        ))}
      </ol>
      <p className="service-status-note">Status changes may include Under Review, Scheduled, In Progress, Completed, or Rejected. Keep this reference to check your request later.</p>
      <button className="service-secondary-button" type="button" onClick={onReset}>Submit another request</button>
    </section>
  )
}
