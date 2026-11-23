import { Link } from 'react-router-dom'
import { SERVICES, ServiceIcon, ServicePageLayout } from './ServiceShared.jsx'
import managementLogo from '../src/assets/managementLogo.jpg'

const STEPS = [
  { title: 'Choose a service', text: 'Pick the request that matches what you need.' },
  { title: 'Fill in the form', text: 'Add your contact details, location, and a clear photo.' },
  { title: 'Track your request', text: 'Use your reference number to follow its status.' },
]

const HERO_STYLES = `
.sv-hero {
  position: relative;
  width: 100vw;
  margin-left: calc(50% - 50vw);
  min-height: 340px;
  display: flex;
  align-items: center;
  overflow: hidden;
  background: linear-gradient(135deg, #a9d79a 0%, #7cc072 55%, #5fae62 100%);
  color: #0b3d24;
}
.sv-hero-art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.sv-hero-inner {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 56px 24px;
  box-sizing: border-box;
}
.sv-hero h1 {
  margin: 0 0 14px;
  max-width: 520px;
  font-size: clamp(32px, 5vw, 56px);
  line-height: 1.08;
  font-weight: 800;
}
.sv-hero p {
  margin: 0;
  max-width: 480px;
  font-size: clamp(16px, 2vw, 20px);
  line-height: 1.4;
  font-weight: 500;
  color: #124a2d;
}
.sv-hero-cta {
  display: inline-flex;
  align-items: center;
  margin-top: 24px;
  min-height: 48px;
  padding: 0 28px;
  border-radius: 999px;
  background: #111;
  color: #fff;
  font-weight: 600;
  text-decoration: none;
}
.sv-hero-cta:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }

@media (max-width: 820px) {
  .sv-hero-art { opacity: .55; }
  .sv-hero-inner { padding: 40px 16px; }
}
`

function HeroArt() {
  const outline = { fill: 'none', stroke: '#3f8f4f', strokeWidth: 2, strokeLinecap: 'round', opacity: 0.55 }
  const pin = (x, y) => (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 0c-9-12-12-16-12-22a12 12 0 1 1 24 0c0 6-3 10-12 22Z" fill="#2f7d46" />
      <circle cy="-22" r="4.5" fill="#bfe5b0" />
    </g>
  )
  return (
    <svg className="sv-hero-art" viewBox="0 0 1200 360" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      {/* soft background blobs */}
      <path d="M520 360C560 250 700 230 800 270s130 80 120 90Z" fill="#6fb667" opacity=".55" />
      <path d="M940 0c-60 70-30 150 40 180s150 20 220-30V0Z" fill="#5aa85d" opacity=".5" />

      {/* street map, right */}
      <g transform="translate(900 40)">
        <rect width="300" height="320" rx="0" fill="#74bb6c" opacity=".6" />
        <g fill="#8fcb82" opacity=".9">
          <rect x="14" y="14" width="80" height="70" rx="10" />
          <rect x="110" y="14" width="70" height="110" rx="10" />
          <rect x="196" y="14" width="90" height="60" rx="10" />
          <rect x="14" y="100" width="80" height="90" rx="10" />
          <rect x="196" y="90" width="90" height="100" rx="10" />
          <rect x="14" y="206" width="110" height="100" rx="10" />
          <rect x="140" y="140" width="40" height="166" rx="10" />
          <rect x="196" y="206" width="90" height="100" rx="10" />
        </g>
        <image href={managementLogo} x="211" y="216" width="60" height="60" preserveAspectRatio="xMidYMid meet" style={{ mixBlendMode: 'multiply' }} />
        {pin(60, 70)}{pin(150, 120)}{pin(250, 60)}{pin(225, 175)}{pin(70, 250)}
        <circle cx="150" cy="215" r="6" fill="#f2994a" />
      </g>

      {/* recycling bin */}
      <g transform="translate(560 120)">
        <path d="M0 60h250l-24 170a14 14 0 0 1-14 12H38a14 14 0 0 1-14-12Z" fill="#3a9b57" />
        <path d="M0 60h250l-8 56H8Z" fill="#2f8a4c" />
        <rect x="-10" y="42" width="270" height="22" rx="10" fill="#1f6b3a" />
        {/* recycle symbol */}
        <g transform="translate(125 160) scale(1.7)" stroke="#e8f6df" strokeWidth="6" strokeLinecap="round" fill="none">
          {[0, 120, 240].map((deg) => (
            <g key={deg} transform={`rotate(${deg})`}>
              <path d="M-22 12 L-9 -10" />
              <polygon points="-5,-17 -5.2,-6.8 -13.8,-11.8" fill="#e8f6df" strokeWidth="2" />
            </g>
          ))}
        </g>
        {/* items on top */}
        <g transform="translate(20 -30)">
          <rect x="0" y="0" width="34" height="48" rx="8" fill="#f4d35e" />
          <rect x="0" y="12" width="34" height="8" fill="#e0b93a" />
        </g>
        <g transform="translate(150 -60)">
          <path d="M12 0h14v22c10 8 14 20 14 34v38H0V56c0-14 4-26 12-34Z" fill="#2f7d46" />
          <rect x="10" y="-6" width="18" height="10" rx="3" fill="#1f6b3a" />
        </g>
        <g transform="translate(75 -8) rotate(-12)">
          <rect width="70" height="46" rx="4" fill="#eaf5dc" />
          <path d="M8 12h54M8 22h54M8 32h34" stroke="#8cc57f" strokeWidth="3" strokeLinecap="round" />
        </g>
      </g>

      {/* leaf line art */}
      <g {...outline}>
        <path d="M470 330c-10-60 10-110 50-140 20 60 5 120-50 140Z" />
        <path d="M470 330c15-45 30-80 50-140" />
        <path d="M850 340c10-50-5-90-40-115-18 50-10 95 40 115Z" />
        <path d="M850 340c-10-35-22-68-40-115" />
        <path d="M380 340c-5-35 5-65 30-85 12 40 2 75-30 85Z" />
      </g>
    </svg>
  )
}

function ServicesHero() {
  return (
    <>
      <style>{HERO_STYLES}</style>
      <section className="sv-hero" aria-labelledby="sv-hero-title">
        <HeroArt />
        <div className="sv-hero-inner">
          <h1 id="sv-hero-title">Waste management, made simple.</h1>
          <p>Request pickups, report issues, and sell recyclables, all in one place for Barangay Bagong Silangan.</p>
          <a className="sv-hero-cta" href="#sv-services">Get started</a>
        </div>
      </section>
    </>
  )
}

// Hub: the resident picks a service first. Each card opens its own page.
export default function ServicesPage() {
  return (
    <ServicePageLayout>
      <ServicesHero />

      <section className="sv-process" aria-labelledby="sv-process-title">
        <div className="sv-process-heading">
          <p>HOW IT WORKS</p>
        </div>
        <ol className="sv-steps" aria-label="How requests work">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="sv-step-num" aria-hidden="true">{index + 1}</span>
              <div><strong>{step.title}</strong><span>{step.text}</span></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="sv-request-list" aria-labelledby="sv-services-title">
        <div className="sv-request-heading">
          <div><h2 id="sv-services-title">What do you need help with?</h2></div>
          <span>Choose a service to get started</span>
        </div>
      <div id="sv-services" className="sv-hub-grid">
        {SERVICES.map((service) => (
          <Link key={service.id} to={service.to} className="sv-card" aria-label={`${service.title}. ${service.description}`}>
            <div className="sv-card-top">
              <span className="sv-card-icon"><ServiceIcon name={service.icon} size={30} /></span>
            </div>
            <div>
              <h2>{service.title}</h2>
              <p>{service.description}</p>
            </div>
            <ul className="sv-tags" aria-label="Includes">
              {service.tags.map((tag) => <li key={tag}>{tag}</li>)}
            </ul>
            <div className="sv-card-foot">
              <span className="sv-card-needs"><b>You'll need:</b> {service.needs}</span>
              <span className="sv-card-go">Start request<ServiceIcon name="arrow" size={16} /></span>
            </div>
          </Link>
        ))}
      </div>
      </section>
    </ServicePageLayout>
  )
}
