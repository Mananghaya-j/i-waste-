import { useState } from 'react'

/* =====================================================================
   i-WASTE Apps Â· Home (Guest tracking view)
   Module 1: Guest access / optional login
   Module 2: Garbage Truck Tracking (Resident & Guest view)

   DATA NOTE
   TRUCKS below is SAMPLE data. In the real system it comes from the
   Admin's latest Trip Ticket / QR scan (no GPS). Replace TRUCKS with a
   fetch() result of the same shape and the page will render it.

   Optional props: onLogin(role), onRegister()  ->  wire to your router.
   ===================================================================== */

/* Checkpoints on the sample map (7 points = 6 streets). */
const ROUTE_POINTS = [
  [38, 300], [38, 214], [124, 214], [124, 128], [214, 128], [214, 52], [286, 52],
]

const STREET_SETS = {
  A: ['Sampaguita St.', 'Rosal St.', 'Gumamela St.', 'Orchid St.', 'Ilang-Ilang St.', 'Jasmine St.'],
  B: ['Mabini St.', 'Rizal Ave.', 'Bonifacio St.', 'Luna St.', 'Del Pilar St.', 'Quezon Ave.'],
  C: ['Narra St.', 'Molave St.', 'Acacia St.', 'Mahogany St.', 'Yakal St.', 'Kamagong St.'],
}

/*
  status : 'Active' | 'Idle' | 'Maintenance' | 'Route Completed'
  phase  : 'arrived' (servicing a street) | 'enroute' (dispatched, not yet at
           first street) | 'completed' | 'off' (not running)
  progress : number of streets already completed (0-6)
  arrivals : arrival timestamp for each street reached so far
*/
const TRUCKS = [
  {
    id: 'T-01', plate: 'SAMPLE 101', ticket: 'TT-0001', status: 'Active', phase: 'arrived',
    progress: 3, streets: 'A', routeStart: '07:35', routeEnd: null,
    arrivals: ['07:40', '08:05', '08:32', '09:00'], updated: '09:00',
  },
  {
    id: 'T-02', plate: 'SAMPLE 102', ticket: 'TT-0002', status: 'Active', phase: 'enroute',
    progress: 0, streets: 'B', routeStart: '08:10', routeEnd: null,
    arrivals: [], updated: '08:10',
  },
  {
    id: 'T-03', plate: 'SAMPLE 103', ticket: 'TT-0003', status: 'Route Completed', phase: 'completed',
    progress: 6, streets: 'C', routeStart: '06:30', routeEnd: '09:55',
    arrivals: ['06:35', '07:00', '07:28', '07:59', '08:40', '09:12'], updated: '09:55',
  },
  {
    id: 'T-04', plate: 'SAMPLE 104', ticket: 'â€”', status: 'Maintenance', phase: 'off',
    progress: 0, streets: 'A', routeStart: null, routeEnd: null,
    arrivals: [], updated: '07:05',
  },
]

const STATUS_CLASS = {
  Active: 'active',
  Idle: 'idle',
  Maintenance: 'maint',
  'Route Completed': 'done',
}
const ARRIVAL_LABEL = {
  arrived: 'Arrived',
  enroute: 'En Route',
  completed: 'Completed',
  off: 'Not running',
}

/* ---------- helpers ---------- */

const today = new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })

function describe(truck) {
  const streets = STREET_SETS[truck.streets]
  const total = streets.length
  const now = truck.phase === 'arrived' ? streets[truck.progress] : null
  let headline
  let detail
  if (truck.phase === 'arrived') {
    headline = `Servicing ${now}`
    detail = `Arrived at ${truck.arrivals[truck.progress]}. ${truck.progress} of ${total} streets already completed.`
  } else if (truck.phase === 'enroute') {
    headline = `On the way to ${streets[0]}`
    detail = `Route started at ${truck.routeStart}. It has not reached the first street yet.`
  } else if (truck.phase === 'completed') {
    headline = 'Route completed'
    detail = `All ${total} streets were collected. Finished at ${truck.routeEnd}.`
  } else {
    headline = 'Not on the road'
    detail = 'This truck is under maintenance and is not running a route today.'
  }
  return { streets, total, now, headline, detail }
}

function streetState(truck, i) {
  if (truck.phase === 'off') return 'off'
  if (i < truck.progress) return 'done'
  if (i === truck.progress && truck.phase === 'arrived') return 'now'
  return 'next'
}

function findMyStreet(truck, streets, i) {
  const name = streets[i]
  if (truck.phase === 'off') return `${truck.id} is under maintenance, so it will not reach ${name} today.`
  const s = streetState(truck, i)
  if (s === 'done') return `Collected. ${truck.id} already finished ${name} (arrived ${truck.arrivals[i]}).`
  if (s === 'now') return `Happening now. ${truck.id} is servicing ${name} (arrived ${truck.arrivals[i]}).`
  const before = i - truck.progress
  const dot = name.endsWith('.') ? '' : '.'
  return `Not yet. ${before} ${before === 1 ? 'street' : 'streets'} to go before ${truck.id} reaches ${name}${dot}`
}

/* ---------- small pieces ---------- */

function Icon({ name, size = 18 }) {
  const p = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
  }
  switch (name) {
    case 'check': return <svg {...p} strokeWidth={2.6}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
    case 'truck': return (
      <svg {...p}><path d="M2 6h11v10H2z" /><path d="M13 9h4l3 3v4h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></svg>
    )
    case 'clock': return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
    case 'lock': return <svg {...p}><rect x="5" y="10.5" width="14" height="9.5" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" /></svg>
    case 'tool': return <svg {...p}><path d="M14.5 6.5a4 4 0 005 5L10 21a2.1 2.1 0 01-3-3z" /><path d="M14.5 6.5l3-3" /></svg>
    default: return null
  }
}

function RecycleMark({ size = 26 }) {
  const arm = (rot) => (
    <g transform={`rotate(${rot})`} key={rot}>
      <path d="M6.7 -25.1 A26 26 0 0 1 25.1 6.7" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" />
      <polygon points="22.5,17.5 35.5,9.5 15.5,3.5" fill="#fff" />
    </g>
  )
  return (
    <svg width={size} height={size} viewBox="-42 -42 84 84" aria-hidden="true">
      {[0, 120, 240].map(arm)}
    </svg>
  )
}

function RouteMap({ progress, phase }) {
  const blocks = [
    [8, 8, 90, 80], [110, 8, 80, 80], [8, 100, 90, 98], [150, 150, 150, 80],
    [8, 232, 90, 56], [148, 240, 150, 100], [232, 80, 76, 56],
  ]
  const pts = (a) => a.map((p) => p.join(',')).join(' ')
  const done = ROUTE_POINTS.slice(0, progress + 1)
  const todo = ROUTE_POINTS.slice(progress)
  const [tx, ty] = ROUTE_POINTS[progress]
  const off = phase === 'off'
  return (
    <svg className="iw-map" viewBox="0 0 320 350" preserveAspectRatio="xMidYMid slice" role="img"
      aria-label={`Route map. Truck position: checkpoint ${progress + 1} of ${ROUTE_POINTS.length}.`}>
      <rect width="320" height="350" fill="#6fae6c" />
      {blocks.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx="14" fill={i % 2 ? '#8dc283' : '#a4d29a'} />
      ))}
      <polyline points={pts(ROUTE_POINTS)} fill="none" stroke="#2f6b3f" strokeOpacity=".35" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={pts(todo)} fill="none" stroke="#fff" strokeWidth="4" strokeDasharray="2 9" strokeLinecap="round" strokeLinejoin="round" />
      {!off && <polyline points={pts(done)} fill="none" stroke="#1f4a2c" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />}
      {ROUTE_POINTS.map(([x, y], i) => {
        const reached = !off && i <= progress
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={reached ? 7 : 6} fill={reached ? '#1f4a2c' : '#fff'} stroke="#1f4a2c" strokeWidth="2.5" />
            {reached && <path d={`M${x - 3} ${y} l2.2 2.4 4-4.6`} fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />}
          </g>
        )
      })}
      <g transform={`translate(${tx} ${ty - 34})`} opacity={off ? 0.55 : 1}>
        <path d="M0 34 C-6 24 -20 20 -20 2 a20 20 0 0 1 40 0 c0 18 -14 22 -20 32z" fill="#fff" stroke="#1f4a2c" strokeWidth="2.5" />
        <g transform="translate(-10 -7) scale(.85)" fill="none" stroke="#1f4a2c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 4h11v9H1z" /><path d="M12 7h4l3 3v3h-7" />
          <circle cx="5" cy="14.5" r="1.4" fill="#1f4a2c" /><circle cx="15" cy="14.5" r="1.4" fill="#1f4a2c" />
        </g>
      </g>
    </svg>
  )
}

/* ---------- page ---------- */

const homeStyles = String.raw`
/* i-WASTE Home. All classes are prefixed "iw-" so they will not clash with your other CSS. */
.iw {
  --g50: #f3f8ec; --g100: #e3efd3; --g200: #c9e0ad; --g300: #b3d38f; --g400: #8fbf7a;
  --g500: #5fa56a; --g600: #3f8451; --g700: #2f6b3f; --g800: #1f4a2c;
  --ink: #121512; --paper: #fbfdf7; --muted: #55655a;
  font-family: 'Poppins', system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: var(--ink);
  background: var(--paper);
  line-height: 1.5;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}
.iw *, .iw *::before, .iw *::after { box-sizing: border-box; }
:where(.iw) :is(h1, h2, h3, p, dl, dd) { margin: 0; }
:where(.iw) a { color: inherit; text-decoration: none; }
.iw a.iw-btn, .iw a.iw-link { text-decoration: none; }
.iw button { font: inherit; cursor: pointer; }
.iw :focus-visible { outline: 3px solid var(--g700); outline-offset: 3px; }
.iw-wrap { width: min(1160px, 100% - 40px); margin-inline: auto; }

/* Buttons */
.iw-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 14px 28px; border-radius: 999px; border: 2px solid var(--ink);
  font-weight: 600; transition: transform .15s, background .15s, color .15s;
}
.iw-btn:hover { transform: translateY(-2px); }
.iw-btn-dark { background: var(--ink); color: #fff; }
.iw-btn-dark:hover { background: var(--g800); border-color: var(--g800); }
.iw-btn-ghost { background: transparent; color: var(--ink); }
.iw-btn-ghost:hover { background: var(--ink); color: #fff; }
.iw-btn-sm { padding: 9px 20px; font-size: .9rem; }
.iw-link { font-weight: 600; padding: 8px 14px; border-radius: 999px; }
.iw-link:hover { background: var(--g100); }

/* Header */
.iw-header {
  position: sticky; top: 0; z-index: 20; background: rgba(251, 253, 247, .92);
  backdrop-filter: blur(10px); border-bottom: 1px solid var(--g100);
}
.iw-nav { display: flex; align-items: center; justify-content: space-between; height: 68px; }
.iw-logo { display: inline-flex; align-items: center; gap: 10px; font-size: 1.3rem; font-weight: 500; }
.iw-logo b { font-weight: 700; }
.iw-logo-mark { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 12px; background: var(--g700); }
.iw-nav-actions { display: flex; align-items: center; gap: 8px; }

/* Hero */
.iw-hero {
  padding: 28px 0 56px;
  background: radial-gradient(900px 420px at 88% 0%, var(--g200), transparent 70%), linear-gradient(180deg, var(--g100), var(--paper));
}
.iw-guest-bar {
  display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px 20px;
  background: #fff; border-radius: 999px; padding: 8px 8px 8px 18px; margin-bottom: 36px;
  font-size: .85rem; color: var(--g800); box-shadow: 0 6px 20px -14px rgba(31, 74, 44, .6);
}
.iw-guest-bar > span { display: inline-flex; align-items: center; gap: 6px; }
.iw-guest-links { gap: 4px !important; }
.iw-guest-links a {
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 999px;
  background: var(--g100); font-weight: 600; font-size: .8rem;
}
.iw-guest-links a:hover { background: var(--g200); }
.iw-eyebrow { font-size: .8rem; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--g700); margin-bottom: 10px; }
.iw-hero h1 { font-size: clamp(2.2rem, 5vw, 3.6rem); line-height: 1.1; font-weight: 600; letter-spacing: -.02em; }
.iw-lead { color: var(--muted); max-width: 58ch; margin: 12px 0 26px; }

.iw-trucks { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px; }
.iw-truck-chip {
  display: inline-flex; align-items: center; gap: 10px; white-space: nowrap;
  background: #fff; border: 2px solid transparent; border-radius: 999px; padding: 10px 18px;
  font-size: .9rem; color: var(--ink); box-shadow: 0 6px 18px -14px rgba(31, 74, 44, .7);
}
.iw-truck-chip span { color: var(--muted); font-size: .82rem; }
.iw-truck-chip.on { background: var(--ink); color: #fff; }
.iw-truck-chip.on span { color: var(--g200); }

/* Status dots/colours (always paired with a text label) */
.iw-dot { width: 10px; height: 10px; border-radius: 50%; background: #2fb457; display: inline-block; flex: none; }
.iw-dot.idle { background: #e3b53a; }
.iw-dot.maint { background: #e8793a; }
.iw-dot.done { background: var(--g800); }

/* Board */
.iw-board {
  display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: -24px; padding-bottom: 72px;
}
.iw-card, .iw-status-card, .iw-map-card { border-radius: 28px; }
.iw-card { background: #fff; border: 1px solid var(--g200); padding: 28px; }
.iw-card h3 { font-size: 1.15rem; font-weight: 600; margin-bottom: 16px; }

.iw-status-card {
  background: linear-gradient(160deg, var(--g800), var(--g700)); color: #fff; padding: 32px;
  box-shadow: 0 24px 40px -24px rgba(31, 74, 44, .8);
}
.iw-status-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 22px; }
.iw-status {
  display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px; border-radius: 999px;
  background: #fff; color: var(--ink); font-weight: 600; font-size: .85rem;
}
.iw-status .iw-dot { background: #2fb457; box-shadow: 0 0 0 4px rgba(47, 180, 87, .25); }
.iw-status.idle .iw-dot { background: #e3b53a; box-shadow: 0 0 0 4px rgba(227, 181, 58, .3); }
.iw-status.maint .iw-dot { background: #e8793a; box-shadow: 0 0 0 4px rgba(232, 121, 58, .3); }
.iw-status.done .iw-dot { background: var(--g800); box-shadow: none; }
.iw-arrival {
  border: 1.5px solid rgba(255, 255, 255, .6); border-radius: 999px; padding: 5px 14px;
  font-size: .8rem; font-weight: 600; letter-spacing: .04em; text-transform: uppercase;
}
.iw-status-card h2 { font-size: clamp(1.7rem, 3.2vw, 2.3rem); line-height: 1.15; font-weight: 600; letter-spacing: -.01em; }
.iw-detail { color: var(--g100); margin-top: 8px; max-width: 46ch; }

.iw-progress { margin-top: 26px; }
.iw-progress-label { display: flex; justify-content: space-between; font-size: .85rem; color: var(--g100); margin-bottom: 8px; }
.iw-progress-label b { color: #fff; }
.iw-bar { height: 12px; border-radius: 999px; background: rgba(255, 255, 255, .22); overflow: hidden; }
.iw-bar i { display: block; height: 100%; background: var(--g300); border-radius: 999px; transition: width .5s ease; }

.iw-facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 26px 0; }
.iw-facts div { background: rgba(255, 255, 255, .1); border-radius: 16px; padding: 12px 14px; }
.iw-facts dt { font-size: .72rem; color: var(--g200); text-transform: uppercase; letter-spacing: .05em; }
.iw-facts dd { font-weight: 600; font-size: .92rem; margin-top: 2px; }

.iw-milestones { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
.iw-milestones li {
  display: grid; grid-template-columns: 20px 1fr auto; gap: 10px; align-items: center;
  padding: 10px 14px; border-radius: 14px; background: rgba(255, 255, 255, .08); color: var(--g200); font-size: .9rem;
}
.iw-milestones li.ok { background: rgba(255, 255, 255, .18); color: #fff; }

/* Map */
.iw-map-card { position: relative; overflow: hidden; border: 8px solid #fff; box-shadow: 0 24px 40px -24px rgba(31, 74, 44, .6); min-height: 380px; }
.iw-map { width: 100%; height: 100%; display: block; position: absolute; inset: 0; }
.iw-map-off {
  position: absolute; inset: 16px 16px auto 16px; display: flex; align-items: center; justify-content: center; gap: 8px;
  background: #fff; border-radius: 16px; padding: 12px; font-weight: 600;
}
.iw-legend {
  position: absolute; right: 14px; bottom: 14px; display: flex; flex-wrap: wrap; gap: 6px 14px;
  background: rgba(255, 255, 255, .95); border-radius: 999px; padding: 6px 14px; font-size: .75rem; font-weight: 500;
}
.iw-legend span { display: inline-flex; align-items: center; gap: 6px; }
.iw-legend i { width: 16px; height: 5px; border-radius: 3px; display: inline-block; }
.lg-done { background: var(--g800); }
.lg-todo { background: repeating-linear-gradient(90deg, #8aa88a 0 3px, transparent 3px 7px); }
.lg-pin { width: 10px !important; height: 10px !important; border-radius: 50% !important; background: #fff; border: 2.5px solid var(--g800); }

/* Streets */
.iw-streets { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
.iw-streets li {
  display: grid; grid-template-columns: 28px 1fr auto; gap: 12px; align-items: center;
  padding: 11px 14px; border-radius: 16px; background: var(--g50);
}
.iw-step {
  width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center;
  font-size: .72rem; font-weight: 600; border: 2px solid var(--g500); color: var(--g700);
}
.iw-streets .done .iw-step { background: var(--g700); border-color: var(--g700); color: #fff; }
.iw-streets .now { background: var(--g100); box-shadow: inset 0 0 0 2px var(--g700); }
.iw-streets .now .iw-step { background: var(--ink); border-color: var(--ink); color: #fff; }
.iw-streets .next, .iw-streets .off { color: var(--muted); }
.iw-street-name { font-weight: 500; }
.iw-street-meta { font-size: .8rem; color: var(--muted); text-align: right; }
.iw-streets .now .iw-street-meta { color: var(--g700); font-weight: 600; }
.iw-fine { font-size: .75rem; color: var(--muted); margin-top: 14px; }

/* Side column */
.iw-side { display: grid; gap: 24px; align-content: start; }
.iw-find label { display: block; font-size: .85rem; color: var(--muted); margin-bottom: 8px; }
.iw-find select {
  width: 100%; padding: 12px 16px; border-radius: 14px; border: 2px solid var(--g300);
  background: var(--paper); font: inherit; color: var(--ink);
}
.iw-answer { margin-top: 14px; padding: 14px 16px; border-radius: 16px; background: var(--g100); color: var(--g800); font-weight: 500; }
.iw-access { background: linear-gradient(135deg, var(--g300), var(--g400)); border: 0; }
.iw-access p { margin-bottom: 18px; }
.iw-access-btns { display: flex; gap: 10px; flex-wrap: wrap; }
.iw-access .iw-btn-ghost { border-color: var(--ink); }

.iw-footer { border-top: 1px solid var(--g100); background: var(--g50); padding: 28px 0; color: var(--muted); font-size: .85rem; text-align: center; }

/* Responsive */
@media (max-width: 900px) {
  .iw-board { grid-template-columns: 1fr; margin-top: -16px; }
  .iw-map-card { min-height: 360px; }
}
@media (max-width: 560px) {
  .iw-hero { padding-bottom: 44px; }
  .iw-guest-bar { border-radius: 24px; padding: 12px 14px; }
  .iw-status-card { padding: 24px 20px; }
  .iw-facts { grid-template-columns: 1fr; }
  .iw-card { padding: 22px 18px; }
  .iw-link { display: none; }
  .iw-streets li { grid-template-columns: 28px 1fr; }
  .iw-street-meta { grid-column: 2; text-align: left; margin-top: -6px; }
}

`

export default function Home({ onLogin, onRegister }) {
  const [truckId, setTruckId] = useState(TRUCKS[0].id)
  const [myStreet, setMyStreet] = useState('')
  const truck = TRUCKS.find((t) => t.id === truckId)
  const { streets, total, headline, detail } = describe(truck)
  const pct = Math.round((truck.progress / total) * 100)

  const login = (role) => (e) => {
    if (onLogin) { e.preventDefault(); onLogin(role) }
  }
  const register = (e) => {
    if (onRegister) { e.preventDefault(); onRegister() }
  }

  const pickTruck = (id) => { setTruckId(id); setMyStreet('') }

  return (
    <div className="iw">
      <style>{homeStyles}</style>
      <header className="iw-header">
        <div className="iw-wrap iw-nav">
          <a href="#top" className="iw-logo" aria-label="i-WASTE Apps home">
            <span className="iw-logo-mark"><RecycleMark /></span>
            <span>i-<b>WASTE</b></span>
          </a>
          <nav className="iw-nav-actions" aria-label="Account">
            <a href="#login" className="iw-link" onClick={login('resident')}>Log in</a>
            <a href="#register" className="iw-btn iw-btn-dark iw-btn-sm" onClick={register}>Register</a>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="iw-hero">
          <div className="iw-wrap">
            <div className="iw-guest-bar">
              <span className="iw-guest-links">
                <a href="#login" onClick={login('admin')}><Icon name="lock" size={13} /> Admin log in</a>
                <a href="#login" onClick={login('superadmin')}><Icon name="lock" size={13} /> Superadmin log in</a>
              </span>
            </div>

            <p className="iw-eyebrow">Barangay Bagong Silang Â· {today}</p>
            <h1>Garbage truck status</h1>
            <p className="iw-lead">
              Has the truck arrived? Which street is it on? Updates come from the assigned Admin's
              latest Trip Ticket, so there is no GPS tracking.
            </p>

            <div className="iw-trucks" role="tablist" aria-label="Choose a truck">
              {TRUCKS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={t.id === truckId}
                  className={`iw-truck-chip ${t.id === truckId ? 'on' : ''}`}
                  onClick={() => pickTruck(t.id)}
                >
                  <i className={`iw-dot ${STATUS_CLASS[t.status]}`} />
                  <b>{t.id}</b>
                  <span>{t.status}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="iw-wrap iw-board" aria-live="polite">
          {/* Status card */}
          <div className="iw-status-card">
            <div className="iw-status-top">
              <span className={`iw-status ${STATUS_CLASS[truck.status]}`}>
                <i className="iw-dot" /> {truck.status}
              </span>
              <span className={`iw-arrival ${truck.phase}`}>{ARRIVAL_LABEL[truck.phase]}</span>
            </div>

            <h2>{headline}</h2>
            <p className="iw-detail">{detail}</p>

            {truck.phase !== 'off' && (
              <div className="iw-progress">
                <div className="iw-progress-label">
                  <span>Streets completed</span>
                  <b>{truck.progress} / {total}</b>
                </div>
                <div className="iw-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={truck.progress} aria-label="Streets completed">
                  <i style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}

            <dl className="iw-facts">
              <div><dt>Truck</dt><dd>{truck.id} Â· {truck.plate}</dd></div>
              <div><dt>Trip Ticket</dt><dd>{truck.ticket}</dd></div>
              <div><dt>Last updated by Admin</dt><dd>{truck.updated}</dd></div>
            </dl>

            <ol className="iw-milestones" aria-label="Milestones">
              <li className={truck.routeStart ? 'ok' : ''}>
                <Icon name="clock" size={16} /><span>Route start</span><b>{truck.routeStart || 'â€”'}</b>
              </li>
              <li className={truck.arrivals.length ? 'ok' : ''}>
                <Icon name="truck" size={16} /><span>Latest street arrival</span>
                <b>{truck.arrivals.length ? truck.arrivals[truck.arrivals.length - 1] : 'â€”'}</b>
              </li>
              <li className={truck.routeEnd ? 'ok' : ''}>
                <Icon name="check" size={16} /><span>Route completion</span><b>{truck.routeEnd || 'â€”'}</b>
              </li>
            </ol>
          </div>

          {/* Map */}
          <div className="iw-map-card">
            <RouteMap progress={truck.progress} phase={truck.phase} />
            {truck.phase === 'off' && (
              <div className="iw-map-off"><Icon name="tool" size={20} /> Out of service</div>
            )}
            <div className="iw-legend">
              <span><i className="lg-done" /> Completed</span>
              <span><i className="lg-todo" /> Remaining</span>
              <span><i className="lg-pin" /> Truck</span>
            </div>
          </div>

          {/* Streets */}
          <div className="iw-card">
            <h3>Street progress</h3>
            <ol className="iw-streets">
              {streets.map((name, i) => {
                const s = streetState(truck, i)
                return (
                  <li key={name} className={s}>
                    <span className="iw-step">{s === 'done' ? <Icon name="check" size={12} /> : i + 1}</span>
                    <span className="iw-street-name">{name}</span>
                    <span className="iw-street-meta">
                      {s === 'done' && `Done Â· ${truck.arrivals[i]}`}
                      {s === 'now' && `Servicing now Â· since ${truck.arrivals[i]}`}
                      {s === 'next' && (i === truck.progress ? 'Next stop' : 'Upcoming')}
                      {s === 'off' && 'â€”'}
                    </span>
                  </li>
                )
              })}
            </ol>
            <p className="iw-fine">Sample route and times for preview only.</p>
          </div>

          {/* Find my street + access */}
          <div className="iw-side">
            <div className="iw-card iw-find">
              <h3>Find my street</h3>
              <label htmlFor="iw-street">Barangay / street (optional)</label>
              <select id="iw-street" value={myStreet} onChange={(e) => setMyStreet(e.target.value)}>
                <option value="">Select your street</option>
                {streets.map((name, i) => <option key={name} value={i}>{name}</option>)}
              </select>
              {myStreet !== '' && <p className="iw-answer">{findMyStreet(truck, streets, Number(myStreet))}</p>}
            </div>

            <div className="iw-card iw-access">
              <h3>Want your own account?</h3>
              <p>Registration is optional. Guests can already see everything on this page.</p>
              <div className="iw-access-btns">
                <a href="#register" className="iw-btn iw-btn-dark iw-btn-sm" onClick={register}>Register</a>
                <a href="#login" className="iw-btn iw-btn-ghost iw-btn-sm" onClick={login('resident')}>Log in</a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="iw-footer">
        <div className="iw-wrap">
          Integrated Waste Access System, Tracking &amp; Education Â· Barangay Bagong Silang
        </div>
      </footer>
    </div>
  )
}


