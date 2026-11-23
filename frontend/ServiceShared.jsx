import { Link, NavLink } from 'react-router-dom'
import SiteNavbar from '../src/components/SiteNavbar.jsx'

// Single source of truth for the four resident services.
// Used by the hub cards, the tab bar, and (if you want) the Home quick actions.
export const SERVICES = [
  {
    id: 'pickup',
    to: '/pickup',
    icon: 'truck',
    tabLabel: 'Waste & oil pickup',
    module: 'Module 3',
    title: 'Waste & cooking oil pickup',
    description: 'Book a truck for household waste, bulky special waste, or used cooking oil.',
    tags: ['Household waste', 'Special waste', 'Cooking oil'],
    needs: 'Contact number, address, photo',
  },
  {
    id: 'tree',
    to: '/tree',
    icon: 'tree',
    tabLabel: 'Tree cutting & pruning',
    module: 'Module 4',
    title: 'Tree cutting & pruning',
    description: 'Ask for a tree on your land to be trimmed or removed, or report a hazardous tree.',
    tags: ['Pruning', 'Cutting', 'Hazard report'],
    needs: 'Location, photo, DENR document when cutting on own land',
  },
  {
    id: 'waterway',
    to: '/waterway',
    icon: 'drop',
    tabLabel: 'Waterway cleaning',
    module: 'Module 4',
    title: 'Canal & waterway cleaning',
    description: 'Report a clogged or dirty public canal, drainage, or waterway so it can be cleared.',
    tags: ['Public canals', 'Drainage', 'Clogging'],
    needs: 'Public location, description, photo',
  },
  {
    id: 'recyclables',
    to: '/recyclables',
    icon: 'recycle',
    tabLabel: 'Sell recyclables',
    module: 'Module 5',
    title: 'Sell recyclable materials',
    description: 'Sell sorted recyclables, get an indicative estimate, and choose pickup or drop-off.',
    tags: ['Plastic', 'Paper & cardboard', 'Metal & glass'],
    needs: 'Material type, photos, pickup address',
  },
]

const REQUEST_STATUSES = ['Submitted', 'Under Review', 'Scheduled', 'In Progress', 'Completed']

export function ServiceIcon({ name, size = 24 }) {
  const props = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round',
    strokeLinejoin: 'round', 'aria-hidden': true,
  }
  switch (name) {
    case 'truck': return <svg {...props}><path d="M2 6h12v11H2zM14 10h4l4 4v3h-8" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></svg>
    case 'tree': return <svg {...props}><path d="M12 22v-6" /><path d="M12 16c-4 0-7-2.6-7-6 0-2 1.2-3.5 2.8-4.3C8.3 3.6 10 2 12 2s3.7 1.6 4.2 3.7C17.8 6.5 19 8 19 10c0 3.4-3 6-7 6Z" /></svg>
    case 'drop': return <svg {...props}><path d="M12 3s6 6.2 6 10.5A6 6 0 0 1 6 13.5C6 9.2 12 3 12 3Z" /><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5" /></svg>
    case 'recycle': return <svg {...props}><path d="M20 12a8 8 0 0 0-14-5.3L4 9M4 4v5h5" /><path d="M4 12a8 8 0 0 0 14 5.3L20 15M20 20v-5h-5" /></svg>
    case 'arrow': return <svg {...props}><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
    case 'back': return <svg {...props}><path d="M19 12H5m6-6-6 6 6 6" /></svg>
    case 'camera': return <svg {...props}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
    case 'bell': return <svg {...props}><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
    case 'form': return <svg {...props}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 11h6M9 15h4" /></svg>
    default: return null
  }
}

const SERVICE_STYLES = `
.service-app {
  --sv-green: #0f5a3c;
  --sv-green-soft: #e0f1e6;
  --sv-track: #d3e2d9;
  --sv-ink: #10281c;
  --sv-muted: #4f6157;
  --sv-line: #dce8e0;
  --sv-bg: #eff5f1;
  --sv-card: #fff;
}

/* ---------- Tab bar (all services) ---------- */
.sv-tabs {
  display: flex;
  gap: 8px;
  margin: 0 0 24px;
  padding: 6px;
  overflow-x: auto;
  background: var(--sv-card);
  border: 1px solid var(--sv-line);
  border-radius: 16px;
  scrollbar-width: none;
}
.sv-tabs::-webkit-scrollbar { display: none; }
.sv-tab {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 16px;
  border-radius: 11px;
  color: var(--sv-muted);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition: background .15s ease, color .15s ease;
}
.sv-tab:hover { background: var(--sv-bg); color: var(--sv-ink); }
.sv-tab--active, .sv-tab--active:hover { background: var(--sv-green); color: #fff; }

/* ---------- Back link on service pages ---------- */
.sv-back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 9px 12px;
  border: 1px solid var(--sv-line);
  border-radius: 10px;
  color: var(--sv-green);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  background: transparent;
}
.sv-back:hover { text-decoration: underline; }
.service-intro-title-row { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
.service-intro-title-row h1 { min-width: 0; }

/* ---------- Hub ---------- */
.sv-hub-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}
.sv-card {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 28px;
  background: var(--sv-card);
  border: 1px solid var(--sv-line);
  border-radius: 20px;
  color: var(--sv-ink);
  text-decoration: none;
  transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease;
}
.sv-card:hover { border-color: #83bd78; box-shadow: 0 10px 24px rgba(15, 90, 60, .12); transform: translateY(-2px); }
.sv-card:focus-visible, .sv-tab:focus-visible, .sv-back:focus-visible { outline: 3px solid #1f9d63; outline-offset: 2px; }
.sv-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.sv-card-icon {
  display: grid;
  place-items: center;
  width: 60px;
  height: 60px;
  border-radius: 16px;
  background: var(--sv-green-soft);
  color: var(--sv-green);
}
.sv-card-module {
  padding: 5px 12px;
  border-radius: 999px;
  background: var(--sv-bg);
  color: var(--sv-muted);
  font-size: 12px;
  font-weight: 600;
}
.sv-card h2 { margin: 0 0 6px; font-size: 22px; font-weight: 600; line-height: 1.25; }
.sv-card p { margin: 0; font-size: 15px; line-height: 1.5; color: var(--sv-muted); }
.sv-tags { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
.sv-tags li {
  padding: 5px 12px;
  border-radius: 999px;
  background: var(--sv-green-soft);
  color: var(--sv-green);
  font-size: 13px;
  font-weight: 600;
}
.sv-card-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--sv-line);
}
.sv-card-needs { font-size: 13px; color: var(--sv-muted); line-height: 1.4; }
.sv-card-needs b { color: var(--sv-ink); font-weight: 600; }
.sv-card-go {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  background: var(--sv-green);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  transition: transform .18s ease;
}
.sv-card:hover .sv-card-go { transform: translateX(3px); }

.sv-process { margin: 34px 0 42px; }
.sv-process-heading { margin-bottom: 18px; }
.sv-process-heading > p,
.sv-request-heading > div > p {
  margin: 0 0 6px;
  color: #398043;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .12em;
}
.sv-process-heading h2,
.sv-request-heading h2 { margin: 0; color: var(--sv-ink); font-size: clamp(22px, 3vw, 30px); line-height: 1.2; }
.sv-steps {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.sv-steps li {
  position: relative;
  z-index: 1;
  display: flex;
  min-height: 132px;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 12px 16px 14px;
  border: 1px solid var(--sv-line);
  border-radius: 16px;
  background: var(--sv-card);
  text-align: center;
}
.sv-step-num {
  flex: none;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border: 5px solid #eff5f1;
  border-radius: 50%;
  background: var(--sv-green);
  color: #fff;
  font-size: 17px;
  font-weight: 700;
}
.sv-steps strong { display: block; margin-bottom: 5px; font-size: 16px; color: var(--sv-ink); }
.sv-steps li div > span { font-size: 14px; line-height: 1.5; color: var(--sv-muted); }
.sv-request-list { margin-bottom: 36px; }
.sv-request-heading { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.sv-request-heading > span { color: var(--sv-muted); font-size: 14px; }

@media (prefers-reduced-motion: reduce) {
  .sv-card, .sv-card-go, .sv-tab { transition: none; }
  .sv-card:hover, .sv-card:hover .sv-card-go { transform: none; }
}
@media (max-width: 860px) {
  .sv-hub-grid { grid-template-columns: 1fr; }
}
@media (max-width: 600px) {
  .sv-process { margin: 28px 0 34px; }
  .sv-steps { grid-template-columns: 1fr; gap: 12px; }
  .sv-steps li { min-height: 0; flex-direction: row; align-items: flex-start; gap: 13px; padding: 14px; text-align: left; }
  .sv-step-num { width: 42px; height: 42px; }
  .sv-request-heading { align-items: flex-start; flex-direction: column; }
}
@media (max-width: 520px) {
  .sv-card { padding: 22px 18px; }
  .sv-card-foot { flex-direction: column; align-items: stretch; }
  .sv-card-go { justify-content: center; }
}
`

export function ServicePageLayout({ module, title, description, hub = false, showBack = false, mainClassName = '', children }) {
  return (
    <div className="service-app">
      <style>{SERVICE_STYLES}</style>
      <SiteNavbar />
      <main className={`service-main${showBack && !hub ? ' service-main--form' : ''}${mainClassName ? ` ${mainClassName}` : ''}`}>
        {(showBack && !hub || module || title || description) && (
          <section className="service-intro">
            {module && <p className="service-overline">{module}</p>}
            {(title || showBack && !hub) && (
              <div className="service-intro-title-row">
                {title && <h1>{title}</h1>}
                {showBack && !hub && (
                  <Link to="/services" className="sv-back">
                    <ServiceIcon name="back" size={16} />All services
                  </Link>
                )}
              </div>
            )}
            {description && <p>{description}</p>}
          </section>
        )}

        <div className="service-page-content">{children}</div>
      </main>
    </div>
  )
}

export function FileUpload({ id, label, accept = 'image/jpeg,image/png,image/webp', multiple = false, required = false, value, help, onChange }) {
  const files = Array.isArray(value) ? value : value ? [value] : []
  return (
    <label className="service-field service-upload-field" htmlFor={id}>
      <span>{label}{required && <i aria-hidden="true">*</i>}</span>
      <input id={id} type="file" accept={accept} multiple={multiple} required={required} onChange={(event) => {
        const selected = Array.from(event.target.files || [])
        onChange(multiple ? selected : selected[0] || null)
      }} />
      <small>{files.length ? files.map((file) => file.name).join(', ') : help}</small>
    </label>
  )
}

export function ServiceSuccess({ request, title, detail, onReset }) {
  return (
    <section className="service-success" role="status" aria-live="polite">
      <span className="service-success-mark" aria-hidden="true">✓</span>
      <p className="service-overline">REQUEST RECEIVED</p>
      <h2>{title}</h2><p>{detail}</p>
      <div className="service-ticket"><div><span>Request reference</span><strong>{request.reference}</strong></div><span className="service-status-pill">{request.status}</span></div>
      <ol className="request-status-steps" aria-label="Request status">
        {REQUEST_STATUSES.map((status, index) => <li className={index === 0 ? 'request-status-step--current' : ''} key={status} aria-current={index === 0 ? 'step' : undefined}><i /><span>{status}</span></li>)}
      </ol>
      <p className="service-status-note">Status changes may include Under Review, Scheduled, In Progress, Completed, or Rejected. Keep this reference to check your request later.</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button className="service-secondary-button" type="button" onClick={onReset}>Submit another request</button>
        <Link className="service-secondary-button" to="/services" style={{ textDecoration: 'none' }}>Back to all services</Link>
      </div>
    </section>
  )
}
