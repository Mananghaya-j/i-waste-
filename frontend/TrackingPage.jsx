import { useState } from 'react'
import RouteMap from '../src/components/RouteMap.jsx'
import SiteNavbar from '../src/components/SiteNavbar.jsx'

/* ------------------------------------------------------------------ */
/* Module 2: Garbage Truck Tracking (BR-1, BR-2, BR-3)                 */
/* No GPS: truck position = the latest checkpoint an Admin recorded.   */
/* All data below is in-memory demo data; swap the handlers for API    */
/* calls (see the comments marked API).                                */
/* ------------------------------------------------------------------ */

const STATUSES = ['Active', 'Idle', 'Maintenance', 'Route Completed']
const CURRENT_ADMIN = 'Admin Reyes' // API: take from the logged-in user
const TODAY = new Date().toLocaleDateString('en-CA')

const ROUTES = {
  'B-12': {
    name: 'Route B-12',
    barangay: 'Bagong Silangan',
    streets: [
      { name: 'Rizal St.', position: [14.7016, 121.1122] },
      { name: 'Mabini St.', position: [14.7005, 121.1104] },
      { name: 'Bonifacio St.', position: [14.699, 121.1074] },
      { name: 'Luna St.', position: [14.6976, 121.1106] },
      { name: 'Quezon Ave.', position: [14.6958, 121.112] },
      { name: 'Del Pilar St.', position: [14.6936, 121.1106] },
    ],
  },
  'B-07': {
    name: 'Route B-07',
    barangay: 'Bagong Silangan',
    streets: [
      { name: 'Sampaguita St.', position: [14.704, 121.106] },
      { name: 'Orchid St.', position: [14.7028, 121.1042] },
      { name: 'Ilang-Ilang St.', position: [14.701, 121.103] },
      { name: 'Jasmine St.', position: [14.6996, 121.1046] },
    ],
  },
}

const SEED_TRUCKS = [
  { id: 'B-12', plate: 'NBC 4821', type: 'Compactor · 10 m³', crew: 'D. Santos + 3 crew', admin: 'Admin Reyes', routeId: 'B-12', qr: 'IWASTE-TRK-B-12', status: 'Active' },
  { id: 'B-07', plate: 'ABX 1930', type: 'Open dump · 6 m³', crew: 'M. Cruz + 2 crew', admin: 'Admin Reyes', routeId: 'B-07', qr: 'IWASTE-TRK-B-07', status: 'Idle' },
  { id: 'B-03', plate: 'TRK 7712', type: 'Compactor · 8 m³', crew: 'L. Ramos + 2 crew', admin: 'Admin Lim', routeId: 'B-07', qr: 'IWASTE-TRK-B-03', status: 'Maintenance' },
]

const iso = (daysAgo, hour, minute) => {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}
const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString()

function pastTrip(no, truckId, daysAgo, hour, step, total) {
  const routeStart = iso(daysAgo, hour, 0)
  return {
    no, truckId, admin: truckId === 'B-03' ? 'Admin Lim' : 'Admin Reyes',
    date: new Date(routeStart).toLocaleDateString('en-CA'),
    routeStart,
    arrivals: Array.from({ length: total }, (_, i) => iso(daysAgo, hour, 5 + i * step)),
    current: total - 1,
    routeEnd: iso(daysAgo, hour, 5 + total * step),
    total,
  }
}

const SEED_TICKETS = [
  {
    no: `TT-${TODAY.replaceAll('-', '')}-001`, truckId: 'B-12', admin: 'Admin Reyes', date: TODAY,
    routeStart: minutesAgo(55), arrivals: [minutesAgo(48), minutesAgo(14), null, null, null, null],
    current: 1, routeEnd: null, total: 6,
  },
  pastTrip('TT-HIST-004', 'B-07', 1, 6, 14, 4),
  pastTrip('TT-HIST-003', 'B-12', 1, 6, 18, 6),
  pastTrip('TT-HIST-002', 'B-12', 2, 6, 21, 6),
  pastTrip('TT-HIST-001', 'B-07', 3, 7, 12, 4),
]

/* ----------------------------- helpers ----------------------------- */

const fmtTime = (value) => (value ? new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—')
const fmtDate = (value) => new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

// Derives arrival status and progress from a Trip Ticket.
function tripState(ticket) {
  if (!ticket) return { arrival: 'Not dispatched', done: 0, current: -1 }
  if (ticket.routeEnd) return { arrival: 'Completed', done: ticket.total, current: -1 }
  if (ticket.current >= 0) return { arrival: 'Arrived', done: ticket.current, current: ticket.current }
  return { arrival: ticket.routeStart ? 'En Route' : 'Not dispatched', done: 0, current: -1 }
}

function minutesBetween(ticket) {
  if (!ticket.routeStart) return null
  const end = ticket.routeEnd ? new Date(ticket.routeEnd) : new Date()
  return Math.max(0, Math.round((end - new Date(ticket.routeStart)) / 60000))
}

function stopsFor(truck, ticket) {
  const { done, current } = tripState(ticket)
  return ROUTES[truck.routeId].streets.map((street, i) => ({
    ...street,
    state: i < done ? 'done' : i === current ? 'current' : 'pending',
    arrivedAt: ticket?.arrivals[i] || null,
  }))
}

function truckPosition(truck, ticket) {
  const streets = ROUTES[truck.routeId].streets
  const { arrival, current } = tripState(ticket)
  if (arrival === 'Completed') return streets[streets.length - 1].position
  return streets[Math.max(current, 0)].position
}

function reportRows(tickets, trucks) {
  return tickets.map((ticket) => {
    const truck = trucks.find((t) => t.id === ticket.truckId)
    const { done } = tripState(ticket)
    const mins = minutesBetween(ticket)
    return [
      ticket.no, ticket.date, ticket.truckId, truck?.plate ?? '', ticket.admin, ROUTES[truck?.routeId]?.name ?? '',
      fmtTime(ticket.routeStart), fmtTime(ticket.routeEnd), `${done} of ${ticket.total}`, mins === null ? '' : mins,
    ]
  })
}
const REPORT_HEAD = ['Ticket', 'Date', 'Truck', 'Plate', 'Admin', 'Route', 'Route start', 'Route end', 'Streets covered', 'Turnaround (min)']

const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

function download(filename, mime, content) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function exportReport(format, rows) {
  const stamp = new Date().toLocaleDateString('en-CA')
  if (format === 'CSV') {
    const csv = [REPORT_HEAD, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    download(`fleet-tracking-${stamp}.csv`, 'text/csv;charset=utf-8', csv)
    return
  }
  const table = `<table border="1" cellspacing="0" cellpadding="6"><thead><tr>${REPORT_HEAD.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
  if (format === 'Excel') {
    // Excel opens an HTML table saved as .xls. API/production: generate a real .xlsx server-side or with SheetJS.
    download(`fleet-tracking-${stamp}.xls`, 'application/vnd.ms-excel', `<html><head><meta charset="utf-8"></head><body>${table}</body></html>`)
    return
  }
  // PDF: opens the browser print dialog (choose "Save as PDF").
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(`<html><head><title>Fleet tracking report</title><style>body{font:13px system-ui;padding:24px}th{background:#e0f1e6}</style></head><body><h2>Fleet tracking report · ${esc(stamp)}</h2>${table}</body></html>`)
  win.document.close()
  win.print()
}

/* ------------------------------ styles ------------------------------ */

const TRACKING_STYLES = `
.tracking-app {
  --t2-green: #0f5a3c; --t2-soft: #e0f1e6; --t2-track: #d3e2d9; --t2-ink: #10281c;
  --t2-muted: #4f6157; --t2-line: #dce8e0; --t2-bg: #eff5f1; --t2-card: #fff;
  --t2-amber: #6b4a00; --t2-amber-bg: #fdf0cc; --t2-red: #8a1c1c; --t2-red-bg: #fbe0e0;
}
.t2-bar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 20px; }
.t2-tabs, .t2-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.t2-tab, .t2-chip {
  min-height: 40px; padding: 0 16px; border: 1px solid var(--t2-line); border-radius: 999px;
  background: var(--t2-card); color: var(--t2-ink); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer;
}
.t2-tab[aria-pressed='true'], .t2-chip[aria-pressed='true'] { background: var(--t2-green); border-color: var(--t2-green); color: #fff; }
.t2-role { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--t2-muted); }
.t2-role select, .t2-field select, .t2-field input {
  min-height: 40px; padding: 0 12px; border: 1px solid var(--t2-line); border-radius: 10px;
  background: var(--t2-card); color: var(--t2-ink); font: inherit; font-size: 14px; box-sizing: border-box; width: 100%;
}
.t2-role select { width: auto; }
.t2-card { padding: 22px; background: var(--t2-card); border: 1px solid var(--t2-line); border-radius: 20px; color: var(--t2-ink); display: flex; flex-direction: column; gap: 16px; }
.t2-card h2, .t2-card h3 { margin: 0; font-size: 18px; font-weight: 600; }
.t2-card p { margin: 0; }
.t2-sub { font-size: 13px; color: var(--t2-muted); }
.t2-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
.t2-form { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.t2-field { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; min-width: 0; }
.t2-field--full { grid-column: 1 / -1; }
.t2-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; }
.t2-row .t2-field { flex: 1; min-width: 140px; }
.t2-btn {
  min-height: 44px; padding: 0 18px; border: 2px solid var(--t2-green); border-radius: 12px;
  font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; background: var(--t2-card); color: var(--t2-green);
}
.t2-btn--solid { background: var(--t2-green); color: #fff; }
.t2-btn:disabled { opacity: .5; cursor: not-allowed; }
.t2-link { background: none; border: 0; padding: 0; color: var(--t2-green); font: inherit; font-weight: 600; cursor: pointer; text-align: left; }
.t2-msg { padding: 10px 14px; border-radius: 10px; font-size: 14px; background: var(--t2-soft); color: var(--t2-green); }
.t2-msg--error { background: var(--t2-red-bg); color: var(--t2-red); }
.t2-pill { display: inline-flex; align-items: center; padding: 6px 12px; border-radius: 999px; font-size: 13px; font-weight: 600; white-space: nowrap; background: var(--t2-soft); color: var(--t2-green); }
.t2-pill--Idle { background: var(--t2-bg); color: var(--t2-muted); }
.t2-pill--Maintenance { background: var(--t2-red-bg); color: var(--t2-red); }
.t2-pill--En-Route, .t2-pill--Not-dispatched { background: var(--t2-amber-bg); color: var(--t2-amber); }
.t2-arrival { padding: 16px 18px; border-radius: 14px; background: var(--t2-bg); display: flex; flex-direction: column; gap: 4px; }
.t2-arrival strong { font-size: 22px; color: var(--t2-green); }
.t2-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px; color: var(--t2-muted); }
.t2-meta b { display: block; font-size: 15px; color: var(--t2-ink); }
.t2-seg { display: flex; gap: 5px; }
.t2-seg i { flex: 1; height: 7px; border-radius: 4px; background: var(--t2-track); }
.t2-seg i.is-done { background: var(--t2-green); }
.t2-seg-label { display: flex; justify-content: space-between; font-size: 14px; font-weight: 600; margin-bottom: 8px; }
.t2-callout { padding: 12px 14px; border-radius: 12px; border: 1px solid var(--t2-green); background: var(--t2-soft); font-size: 14px; }
.t2-tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.t2-tile { padding: 16px 18px; border: 1px solid var(--t2-line); border-radius: 16px; background: var(--t2-card); color: var(--t2-ink); }
.t2-tile span { display: block; font-size: 13px; color: var(--t2-muted); }
.t2-tile strong { font-size: 30px; }
.t2-scroll { overflow-x: auto; }
.t2-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.t2-table th, .t2-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--t2-line); white-space: nowrap; }
.t2-table th { font-size: 12px; color: var(--t2-muted); font-weight: 600; }
.t2-qr { display: flex; gap: 14px; align-items: center; padding: 12px; border: 1px dashed var(--t2-line); border-radius: 12px; }
.t2-qr svg { width: 84px; height: 84px; flex: none; }
.t2-qr code { font-size: 13px; word-break: break-all; }
.t2-details { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; font-size: 13px; color: var(--t2-muted); }
.t2-details b { display: block; font-size: 14px; color: var(--t2-ink); }
.t2-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.t2-combo { position: relative; display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--t2-muted); }
.t2-combo-box { position: relative; }
.t2-combo input { min-height: 40px; width: 220px; padding: 0 32px 0 12px; border: 1px solid var(--t2-line); border-radius: 10px; background: var(--t2-card); color: var(--t2-ink); font: inherit; font-size: 14px; box-sizing: border-box; }
.t2-combo-clear { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 26px; height: 26px; border: 0; border-radius: 50%; background: transparent; color: var(--t2-muted); font-size: 18px; cursor: pointer; }
.t2-combo-list { position: absolute; z-index: 20; top: calc(100% + 4px); right: 0; width: 220px; max-height: 220px; overflow-y: auto; margin: 0; padding: 4px; list-style: none; background: var(--t2-card); border: 1px solid var(--t2-line); border-radius: 12px; box-shadow: 0 8px 20px rgba(15, 90, 60, .14); }
.t2-combo-list li { padding: 9px 10px; border-radius: 8px; font-size: 14px; color: var(--t2-ink); cursor: pointer; }
.t2-combo-list li.is-active, .t2-combo-list li:hover { background: var(--t2-soft); }
.t2-combo-list li[aria-selected='true'] { font-weight: 700; color: var(--t2-green); }
.t2-combo-list .t2-combo-empty { color: var(--t2-muted); cursor: default; }
.t2-combo input:focus-visible, .t2-combo-clear:focus-visible { outline: 3px solid #1f9d63; outline-offset: 2px; }
.tracking-layout--full { align-items: start; }
.t2-tab:focus-visible, .t2-chip:focus-visible, .t2-btn:focus-visible, .t2-link:focus-visible { outline: 3px solid #1f9d63; outline-offset: 2px; }
@media (max-width: 1100px) { .t2-grid { grid-template-columns: 1fr; } .t2-tiles { grid-template-columns: 1fr 1fr; } }
@media (max-width: 640px) { .t2-form, .t2-details, .t2-meta { grid-template-columns: 1fr; } .t2-tiles { grid-template-columns: 1fr; } }
`

/* --------------------------- small pieces --------------------------- */

// Preview-only QR look-alike (deterministic from the code). Replace with a real
// generator such as `qrcode.react` so printed labels actually scan.
function QrBadge({ code }) {
  const size = 21
  let seed = 0
  for (const ch of code) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0
  const cells = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const corner = [[0, 0], [size - 7, 0], [0, size - 7]].find(([cx, cy]) => x >= cx && x < cx + 7 && y >= cy && y < cy + 7)
      let on
      if (corner) {
        const lx = x - corner[0], ly = y - corner[1]
        on = lx === 0 || lx === 6 || ly === 0 || ly === 6 || (lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4)
      } else {
        seed = (seed * 1664525 + 1013904223) >>> 0
        on = ((seed >>> 16) & 1) === 1
      }
      if (on) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />)
    }
  }
  return (
    <div className="t2-qr">
      <svg viewBox={`0 0 ${size} ${size}`} fill="#10281c" role="img" aria-label={`QR code ${code}`}>{cells}</svg>
      <div><p className="t2-sub">Truck QR code</p><code>{code}</code></div>
    </div>
  )
}

function Pill({ value }) {
  return <span className={`t2-pill t2-pill--${value.replace(/\s+/g, '-')}`}>{value}</span>
}

function ProgressSegments({ done, total }) {
  return (
    <div>
      <div className="t2-seg-label"><span>Collection progress</span><span>{done} of {total} streets</span></div>
      <div className="t2-seg" role="progressbar" aria-label="Collection progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        {Array.from({ length: total }, (_, i) => <i key={i} className={i < done ? 'is-done' : ''} />)}
      </div>
    </div>
  )
}

function StopList({ stops }) {
  return (
    <ol className="tracking-stops">
      {stops.map((stop) => (
        <li className={stop.state === 'pending' ? 'tracking-stop' : `tracking-stop tracking-stop--${stop.state}`} key={stop.name}>
          <i aria-hidden="true" />
          <div>
            <strong>{stop.name}</strong>
            <span>
              {stop.state === 'done' && `Completed · arrived ${fmtTime(stop.arrivedAt)}`}
              {stop.state === 'current' && `Collecting now · arrived ${fmtTime(stop.arrivedAt)}`}
              {stop.state === 'pending' && 'Upcoming'}
            </span>
          </div>
        </li>
      ))}
    </ol>
  )
}

/* Searchable street dropdown (type to filter, arrow keys + Enter, Esc to close) */
function StreetCombobox({ streets, value, onChange }) {
  const [text, setText] = useState(value)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const matches = streets.filter((s) => s.name.toLowerCase().includes(text.trim().toLowerCase()))

  function choose(name) {
    onChange(name)
    setText(name)
    setOpen(false)
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, matches.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && open && matches[active]) { e.preventDefault(); choose(matches[active].name) }
    else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div
      className="t2-combo"
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return
        setOpen(false)
        setText(value)
      }}
    >
      <div className="t2-combo-box">
        <input
          id="street-search"
          role="combobox"
          aria-expanded={open}
          aria-controls="street-options"
          aria-autocomplete="list"
          autoComplete="off"
          placeholder="Search streets…"
          value={text}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
            setActive(0)
            if (!e.target.value) onChange('')
          }}
          onKeyDown={onKeyDown}
        />
        {value && <button type="button" className="t2-combo-clear" aria-label="Clear street filter" onClick={() => { choose(''); setOpen(false) }}>×</button>}
      </div>
      {open && (
        <ul className="t2-combo-list" id="street-options" role="listbox">
          {matches.length === 0 && <li className="t2-combo-empty">No matching streets</li>}
          {matches.map((s, i) => (
            <li
              key={s.name}
              role="option"
              aria-selected={s.name === value}
              className={i === active ? 'is-active' : ''}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(s.name)}
            >
              {s.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ---------------- BR-2: Resident & Guest route view ---------------- */

function ResidentView({ trucks, tickets }) {
  const [truckId, setTruckId] = useState(trucks[0].id)
  const [streetFilter, setStreetFilter] = useState('')
  const truck = trucks.find((t) => t.id === truckId) ?? trucks[0]
  const route = ROUTES[truck.routeId]
  const ticket = tickets.find((t) => t.truckId === truck.id && t.date === TODAY)
  const state = tripState(ticket)
  const stops = stopsFor(truck, ticket)
  const picked = stops.find((s) => s.name === streetFilter)

  const headline = {
    Arrived: `Arrived · servicing ${stops[state.current]?.name}`,
    'En Route': 'En route to the first street',
    Completed: 'Route completed',
    'Not dispatched': truck.status === 'Maintenance' ? 'Truck is under maintenance' : 'Not dispatched yet today',
  }[state.arrival]

  return (
    <>
      <div className="t2-bar">
        <div className="t2-chips" role="group" aria-label="Choose a truck">
          {trucks.map((t) => (
            <button key={t.id} type="button" className="t2-chip" aria-pressed={t.id === truck.id} onClick={() => { setTruckId(t.id); setStreetFilter('') }}>
              {t.id}
            </button>
          ))}
        </div>
        <StreetCombobox key={truck.id} streets={route.streets} value={streetFilter} onChange={setStreetFilter} />
      </div>

      <section className="tracking-layout" aria-label="Live route tracking">
        <article className="tracking-map-card">
          <div className="tracking-card-heading">
            <div>
              <span className="tracking-live"><i /> Based on latest trip ticket</span>
              <h2>{route.name} · {route.barangay}</h2>
            </div>
            <span className="tracking-updated">
              {ticket ? `Last record ${fmtTime(ticket.arrivals.filter(Boolean).at(-1) || ticket.routeStart)}` : 'No trip today'}
            </span>
          </div>
          <div className="tracking-map-window">
            <RouteMap
              stops={stops}
              truck={{ position: truckPosition(truck, ticket), title: `Truck ${truck.id}`, subtitle: headline }}
            />
          </div>
        </article>

        <aside className="tracking-route-card" aria-label={`${route.name} details`}>
          <div className="tracking-route-title">
            <div><span>TRUCK {truck.id}</span><h2>{route.name}</h2></div>
            <Pill value={truck.status} />
          </div>
          <div className="t2-arrival" role="status">
            <span className="t2-sub">Arrival</span>
            <strong>{state.arrival === 'Not dispatched' ? '—' : state.arrival}</strong>
            <span>{headline}</span>
          </div>
          {picked && (
            <p className="t2-callout">
              <b>{picked.name}:</b>{' '}
              {picked.state === 'done' && `already completed (arrived ${fmtTime(picked.arrivedAt)}).`}
              {picked.state === 'current' && 'the truck is collecting here now.'}
              {picked.state === 'pending' && 'the truck has not reached this street yet.'}
            </p>
          )}
          <div className="t2-meta">
            <span>Route start<b>{fmtTime(ticket?.routeStart)}</b></span>
            <span>Route completion<b>{fmtTime(ticket?.routeEnd)}</b></span>
          </div>
          <ProgressSegments done={state.done} total={route.streets.length} />
          <StopList stops={stops} />
          <p className="tracking-note">Positions come from the collection team’s trip ticket records, not GPS, and update when the next street is logged.</p>
        </aside>
      </section>
    </>
  )
}

/* ------------------ BR-1: Admin QR scan & trip ticket ------------------ */

const EMPTY_TRUCK_FORM = { plate: '', id: '', type: '', crew: '', routeId: 'B-12' }

function AdminPanel({ trucks, tickets, scanLog, workingId, onScan, onRegister, onStart, onArrive, onComplete, onStatus }) {
  const [code, setCode] = useState('')
  const [message, setMessage] = useState(null)
  const [showRegister, setShowRegister] = useState(false)
  const [form, setForm] = useState(EMPTY_TRUCK_FORM)

  const truck = trucks.find((t) => t.id === workingId)
  const ticket = truck && tickets.find((t) => t.truckId === truck.id && t.date === TODAY)
  const state = tripState(ticket)
  const stops = truck && ticket ? stopsFor(truck, ticket) : []
  const nextStreet = stops[state.current + 1]
  const started = Boolean(ticket?.routeStart) && !ticket?.routeEnd

  function updateForm(e) { setForm((f) => ({ ...f, [e.target.name]: e.target.value })) }

  function submitScan(e) {
    e.preventDefault()
    const result = onScan(code)
    setMessage(result.error ? { error: true, text: result.error } : { text: `Scanned ${result.truck.id}. Trip ticket is ready below.` })
    if (!result.error) setCode('')
  }

  function submitRegister(e) {
    e.preventDefault()
    const result = onRegister(form)
    if (result.error) { setMessage({ error: true, text: result.error }); return }
    setMessage({ text: `Truck ${result.truck.id} registered and its QR code generated. It will be recognized on future trips.` })
    setForm(EMPTY_TRUCK_FORM)
    setShowRegister(false)
  }

  return (
    <div className="t2-grid">
      <div className="t2-card">
        <div>
          <h2>Scan or register a truck</h2>
          <p className="t2-sub">Showing trucks assigned to {CURRENT_ADMIN}. Enter a QR value or connect your camera scanner (for example html5-qrcode) to this field.</p>
        </div>

        <form className="t2-row" onSubmit={submitScan}>
          <label className="t2-field">
            Truck QR code
            <input list="qr-codes" value={code} onChange={(e) => setCode(e.target.value)} placeholder="IWASTE-TRK-B-12" required />
            <datalist id="qr-codes">{trucks.filter((t) => t.admin === CURRENT_ADMIN).map((t) => <option key={t.id} value={t.qr} />)}</datalist>
          </label>
          <button className="t2-btn t2-btn--solid" type="submit">Scan QR</button>
        </form>

        {message && <p className={`t2-msg${message.error ? ' t2-msg--error' : ''}`} role={message.error ? 'alert' : 'status'}>{message.text}</p>}

        {!showRegister ? (
          <button type="button" className="t2-link" onClick={() => setShowRegister(true)}>Truck has no QR code? Register new truck</button>
        ) : (
          <form className="t2-form" onSubmit={submitRegister}>
            <label className="t2-field">Plate number<input name="plate" value={form.plate} onChange={updateForm} maxLength={12} required /></label>
            <label className="t2-field">Truck ID<input name="id" value={form.id} onChange={updateForm} maxLength={10} placeholder="e.g. B-15" required /></label>
            <label className="t2-field">Vehicle type / capacity<input name="type" value={form.type} onChange={updateForm} maxLength={40} placeholder="Compactor · 10 m³" required /></label>
            <label className="t2-field">Driver / crew<input name="crew" value={form.crew} onChange={updateForm} maxLength={60} required /></label>
            <label className="t2-field t2-field--full">Designated route
              <select name="routeId" value={form.routeId} onChange={updateForm}>{Object.entries(ROUTES).map(([id, r]) => <option key={id} value={id}>{r.name}</option>)}</select>
            </label>
            <div className="t2-actions t2-field--full">
              <button className="t2-btn t2-btn--solid" type="submit">Register & generate QR</button>
              <button className="t2-btn" type="button" onClick={() => setShowRegister(false)}>Cancel</button>
            </div>
          </form>
        )}

        <div>
          <h3>Recent scans</h3>
          {scanLog.length === 0 ? <p className="t2-sub">No scans yet this session.</p> : (
            <div className="t2-scroll">
              <table className="t2-table">
                <thead><tr><th>Time</th><th>Truck</th><th>Event</th><th>Ticket</th></tr></thead>
                <tbody>{scanLog.slice(0, 5).map((l, i) => <tr key={i}><td>{fmtTime(l.time)}</td><td>{l.truckId}</td><td>{l.event}</td><td>{l.ticket}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="t2-card">
        {!truck || !ticket ? (
          <>
            <h2>Trip ticket</h2>
            <p className="t2-sub">Scan or register a truck to open today’s trip ticket with its details pre-filled.</p>
          </>
        ) : (
          <>
            <div className="tracking-route-title">
              <div><span className="t2-sub">Trip ticket</span><h2>{ticket.no}</h2></div>
              <Pill value={truck.status} />
            </div>
            <div className="t2-details">
              <span>Truck ID<b>{truck.id}</b></span>
              <span>Plate<b>{truck.plate}</b></span>
              <span>Vehicle<b>{truck.type}</b></span>
              <span>Driver / crew<b>{truck.crew}</b></span>
              <span>Assigned admin<b>{truck.admin}</b></span>
              <span>Route<b>{ROUTES[truck.routeId].name}</b></span>
            </div>
            <QrBadge code={truck.qr} />

            <label className="t2-field">Operational status
              <select value={truck.status} onChange={(e) => onStatus(truck.id, e.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
            </label>

            <div className="t2-actions">
              <button className="t2-btn t2-btn--solid" type="button" disabled={Boolean(ticket.routeStart) || truck.status === 'Maintenance'} onClick={() => onStart(ticket.no)}>Record route start</button>
              <button className="t2-btn t2-btn--solid" type="button" disabled={!started || !nextStreet} onClick={() => onArrive(ticket.no)}>
                {nextStreet ? `Record arrival: ${nextStreet.name}` : 'All streets recorded'}
              </button>
              <button className="t2-btn" type="button" disabled={!started} onClick={() => onComplete(ticket.no)}>Record route completion</button>
            </div>
            {truck.status === 'Maintenance' && <p className="t2-sub">Change the status from Maintenance before starting a route.</p>}

            <div className="t2-meta">
              <span>Route start<b>{fmtTime(ticket.routeStart)}</b></span>
              <span>Route completion<b>{fmtTime(ticket.routeEnd)}</b></span>
            </div>
            <ProgressSegments done={state.done} total={ticket.total} />
            <StopList stops={stops} />
          </>
        )}
      </div>
    </div>
  )
}

/* --------- BR-3: Fleet monitoring, history & export (Admin/Superadmin) --------- */

function FleetPanel({ trucks, tickets }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [vehicle, setVehicle] = useState('')
  const [status, setStatus] = useState('')
  const [format, setFormat] = useState('CSV')

  const liveTrucks = trucks.filter((t) => (!vehicle || t.id === vehicle) && (!status || t.status === status))
  const history = tickets.filter((t) => (!vehicle || t.truckId === vehicle) && (!from || t.date >= from) && (!to || t.date <= to))
  const rows = reportRows(history, trucks)
  const durations = history.map(minutesBetween).filter((m) => m !== null)
  const streetsCovered = history.reduce((sum, t) => sum + tripState(t).done, 0)
  const avg = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null

  return (
    <div className="t2-stack" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="t2-card">
        <h2>Filters</h2>
        <div className="t2-row">
          <label className="t2-field">From<input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="t2-field">To<input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
          <label className="t2-field">Vehicle
            <select value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
              <option value="">All vehicles</option>
              {trucks.map((t) => <option key={t.id} value={t.id}>{t.id} · {t.plate}</option>)}
            </select>
          </label>
          <label className="t2-field">Operational status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="t2-tiles">
        <div className="t2-tile"><span>Active vehicles</span><strong>{trucks.filter((t) => t.status === 'Active').length}</strong></div>
        <div className="t2-tile"><span>Trips in range</span><strong>{history.length}</strong></div>
        <div className="t2-tile"><span>Streets covered</span><strong>{streetsCovered}</strong></div>
        <div className="t2-tile"><span>Avg turnaround</span><strong>{avg === null ? '—' : `${avg} min`}</strong></div>
      </div>

      <div className="t2-card">
        <h2>Live fleet</h2>
        <div className="t2-scroll">
          <table className="t2-table">
            <thead><tr><th>Truck</th><th>Plate</th><th>Assigned admin</th><th>Status</th><th>Active ticket</th><th>Current street</th><th>Progress</th></tr></thead>
            <tbody>
              {liveTrucks.map((truck) => {
                const ticket = tickets.find((t) => t.truckId === truck.id && t.date === TODAY)
                const state = tripState(ticket)
                const streets = ROUTES[truck.routeId].streets
                return (
                  <tr key={truck.id}>
                    <td>{truck.id}</td><td>{truck.plate}</td><td>{truck.admin}</td><td><Pill value={truck.status} /></td>
                    <td>{ticket?.no ?? '—'}</td>
                    <td>{state.current >= 0 ? streets[state.current].name : state.arrival === 'Completed' ? 'Route completed' : '—'}</td>
                    <td>{state.done} of {streets.length}</td>
                  </tr>
                )
              })}
              {liveTrucks.length === 0 && <tr><td colSpan={7}>No vehicles match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="t2-card">
        <div className="t2-bar" style={{ marginBottom: 0 }}>
          <div><h2>Trip history & route performance</h2><p className="t2-sub">{history.length} trip ticket{history.length === 1 ? '' : 's'} match the filters.</p></div>
          <div className="t2-row">
            <label className="t2-field">Export format
              <select value={format} onChange={(e) => setFormat(e.target.value)}><option>PDF</option><option>Excel</option><option>CSV</option></select>
            </label>
            <button className="t2-btn t2-btn--solid" type="button" disabled={!rows.length} onClick={() => exportReport(format, rows)}>Export {format}</button>
          </div>
        </div>
        <div className="t2-scroll">
          <table className="t2-table">
            <thead><tr>{REPORT_HEAD.map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((row) => <tr key={row[0]}>{row.map((cell, i) => <td key={i}>{i === 1 ? fmtDate(cell) : cell}</td>)}</tr>)}
              {rows.length === 0 && <tr><td colSpan={REPORT_HEAD.length}>No trip tickets in this range.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------- page ------------------------------- */

// `role` comes from your RBAC: 'guest' | 'resident' | 'admin' | 'superadmin'
export default function TrackingPage({ role = 'guest' }) {
  const [view, setView] = useState('resident')
  const [trucks, setTrucks] = useState(SEED_TRUCKS)
  const [tickets, setTickets] = useState(SEED_TICKETS) // newest first
  const [scanLog, setScanLog] = useState([])
  const [workingId, setWorkingId] = useState('')

  const tabs = [
    { id: 'resident', label: 'Route map' },
    ...(role === 'admin' ? [{ id: 'tickets', label: 'Trip tickets & QR' }] : []),
    ...(role !== 'guest' ? [{ id: 'fleet', label: 'Fleet monitoring' }] : []),
  ]
  const activeView = tabs.some((t) => t.id === view) ? view : 'resident'

  const patchTicket = (no, patch) => setTickets((list) => list.map((t) => (t.no === no ? { ...t, ...patch } : t)))
  const log = (truckId, event, ticket) => setScanLog((l) => [{ time: new Date().toISOString(), truckId, event, ticket }, ...l])

  // Opens today's ticket for a truck, reusing an unfinished one if it exists. API: POST /trip-tickets
  function ensureTicket(truck) {
    const open = tickets.find((t) => t.truckId === truck.id && t.date === TODAY && !t.routeEnd)
    if (open) return open.no
    const no = `TT-${TODAY.replaceAll('-', '')}-${String(tickets.filter((t) => t.date === TODAY).length + 1).padStart(3, '0')}`
    const total = ROUTES[truck.routeId].streets.length
    setTickets((list) => [{ no, truckId: truck.id, admin: truck.admin, date: TODAY, routeStart: null, arrivals: Array(total).fill(null), current: -1, routeEnd: null, total }, ...list])
    return no
  }

  function handleScan(raw) {
    const truck = trucks.find((t) => t.qr.toLowerCase() === raw.trim().toLowerCase())
    if (!truck) return { error: 'No truck is registered with this QR code. Use “Register new truck” to generate one.' }
    if (truck.admin !== CURRENT_ADMIN) return { error: `Truck ${truck.id} is assigned to ${truck.admin}. Only the assigned admin can record its trips.` }
    const no = ensureTicket(truck)
    log(truck.id, 'QR scan', no)
    setWorkingId(truck.id)
    return { truck }
  }

  // API: POST /trucks (persist and return the generated QR value)
  function handleRegister(form) {
    const id = form.id.trim().toUpperCase()
    const plate = form.plate.trim().toUpperCase()
    if (trucks.some((t) => t.id === id || t.plate === plate)) return { error: 'A truck with this ID or plate number is already registered.' }
    const truck = { id, plate, type: form.type.trim(), crew: form.crew.trim(), admin: CURRENT_ADMIN, routeId: form.routeId, qr: `IWASTE-TRK-${id.replace(/\s+/g, '')}`, status: 'Idle' }
    setTrucks((list) => [...list, truck])
    const no = ensureTicket(truck)
    log(id, 'Registered + QR generated', no)
    setWorkingId(id)
    return { truck }
  }

  const setStatus = (truckId, status) => setTrucks((list) => list.map((t) => (t.id === truckId ? { ...t, status } : t)))
  const ticketTruck = (no) => tickets.find((t) => t.no === no)?.truckId

  function startRoute(no) {
    patchTicket(no, { routeStart: new Date().toISOString() })
    setStatus(ticketTruck(no), 'Active')
    log(ticketTruck(no), 'Route start', no)
  }
  function recordArrival(no) {
    const ticket = tickets.find((t) => t.no === no)
    const next = ticket.current + 1
    if (next >= ticket.total) return
    const arrivals = ticket.arrivals.slice()
    arrivals[next] = new Date().toISOString()
    patchTicket(no, { arrivals, current: next })
    log(ticket.truckId, `Arrival: street ${next + 1} of ${ticket.total}`, no)
  }
  function completeRoute(no) {
    patchTicket(no, { routeEnd: new Date().toISOString() })
    setStatus(ticketTruck(no), 'Route Completed')
    log(ticketTruck(no), 'Route completion', no)
  }

  return (
    <div className="tracking-app">
      <style>{TRACKING_STYLES}</style>
      <SiteNavbar />
      <main className="tracking-main">
        <header className="tracking-heading">
          <p className="tracking-eyebrow">GARBAGE TRUCK TRACKING</p>
          <h1>Waste collection tracking</h1>
          <p>See whether the truck has reached your street, which street it is on, and which are done.</p>
        </header>

        {tabs.length > 1 && (
          <div className="t2-tabs" role="group" aria-label="Tracking views" style={{ marginBottom: 20 }}>
            {tabs.map((t) => (
              <button key={t.id} type="button" className="t2-tab" aria-pressed={activeView === t.id} onClick={() => setView(t.id)}>{t.label}</button>
            ))}
          </div>
        )}

        {activeView === 'resident' && <ResidentView trucks={trucks} tickets={tickets} />}
        {activeView === 'tickets' && (
          <AdminPanel
            trucks={trucks} tickets={tickets} scanLog={scanLog} workingId={workingId}
            onScan={handleScan} onRegister={handleRegister} onStart={startRoute}
            onArrive={recordArrival} onComplete={completeRoute} onStatus={setStatus}
          />
        )}
        {activeView === 'fleet' && <FleetPanel trucks={trucks} tickets={tickets} />}
      </main>
    </div>
  )
}