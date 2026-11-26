import { useCallback, useEffect, useState } from 'react'
import RouteMap from '../components/RouteMap.jsx'
import SiteNavbar from '../components/SiteNavbar.jsx'
import { authenticatedRequest, publicRequest } from '../services/authApi.js'
import { useAuth } from '../hooks/useAuth.js'
import { estimateArrivals } from '../utils/tracking.js'

const STATUSES = [
  ['ACTIVE', 'Active'],
  ['IDLE', 'Idle'],
  ['MAINTENANCE', 'Maintenance'],
  ['ROUTE_COMPLETED', 'Route Completed'],
]

function normalizeRoute(route) {
  if (!route) return null
  return {
    ...route,
    streets: (route.checkpoints || []).map((checkpoint) => ({
      id: checkpoint.id,
      name: checkpoint.streetName,
      sequence: checkpoint.sequence,
      position: checkpoint.latitude !== null && checkpoint.longitude !== null
        ? [Number(checkpoint.latitude), Number(checkpoint.longitude)]
        : null,
    })),
  }
}

function normalizeTruck(truck, tickets) {
  const latestTicket = tickets.find((ticket) => ticket.truckId === truck.id)
  return {
    id: truck.id,
    displayId: truck.truckId,
    plate: truck.plateNumber,
    type: truck.vehicleType,
    crew: [truck.driverName, truck.crew].filter(Boolean).join(' · ') || 'Not recorded',
    admin: truck.admin?.fullName || 'Unassigned',
    adminId: truck.adminId,
    qr: truck.qrCodeValue,
    qrImage: truck.qrCode,
    currentStreet: truck.currentStreet,
    routeId: latestTicket?.routeId || '',
    status: truck.status,
  }
}

function normalizeTicket(ticket) {
  const route = normalizeRoute(ticket.route)
  const current = ticket.checkpoints?.length ? ticket.checkpoints.length - 1 : -1
  return {
    id: ticket.id,
    no: ticket.tripNo,
    truckId: ticket.truck.id,
    truckCode: ticket.truck.truckId,
    plate: ticket.truck.plateNumber,
    admin: ticket.truck.admin?.fullName || 'Unassigned',
    routeId: route?.id || '',
    route,
    truckDetails: {
      id: ticket.truck.id,
      displayId: ticket.truck.truckId,
      plate: ticket.truck.plateNumber,
      status: ticket.truck.status,
      currentStreet: ticket.truck.currentStreet,
    },
    date: new Date(ticket.startedAt).toLocaleDateString('en-CA'),
    routeStart: ticket.startedAt,
    arrivals: (ticket.checkpoints || []).map((checkpoint) => checkpoint.arrivedAt),
    checkpoints: (ticket.checkpoints || []).map((checkpoint) => ({
      routeCheckpointId: checkpoint.routeCheckpointId,
      streetName: checkpoint.streetName,
      arrivedAt: checkpoint.arrivedAt,
      completed: checkpoint.completed,
      completedAt: checkpoint.completedAt,
    })),
    current,
    routeEnd: ticket.completedAt,
    total: route?.streets.length || 0,
    status: ticket.status,
  }
}

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

function stopsFor(truck, ticket, route) {
  const { done, current } = tripState(ticket)
  return (route?.streets || []).map((street, i) => ({
    ...street,
    state: i < done ? 'done' : i === current ? 'current' : 'pending',
    arrivedAt: ticket?.arrivals[i] || null,
  }))
}

function truckPosition(truck, ticket, route) {
  const streets = route?.streets || []
  if (!streets.length) return null
  const { arrival, current } = tripState(ticket)
  if (arrival === 'Completed') return streets[streets.length - 1].position
  return streets[Math.max(current, 0)].position
}

function formatDateTime(value) {
  return value
    ? new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Not recorded'
}

function formatRemaining(value) {
  if (!value) return null
  const minutes = Math.max(0, Math.round((new Date(value).getTime() - Date.now()) / 60000))
  if (minutes < 60) return `about ${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `about ${hours} hr ${remainder} min` : `about ${hours} hr`
}

function reportRows(tickets, trucks) {
  return tickets.map((ticket) => {
    const truck = trucks.find((t) => t.id === ticket.truckId)
    const { done } = tripState(ticket)
    const mins = minutesBetween(ticket)
    return [
      ticket.no, ticket.date, ticket.truckCode, truck?.plate ?? ticket.plate, ticket.admin, ticket.route?.name ?? '',
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
.t2-route-tracking { display: grid; gap: 18px; }
.t2-route-picker-heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; }
.t2-route-picker-heading h2, .t2-route-picker-heading h3 { margin: 0; color: var(--t2-ink); }
.t2-route-picker-heading .t2-sub { margin-top: 5px; }
.t2-route-options { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; }
.t2-route-option { display: flex; align-items: flex-start; gap: 10px; padding: 12px; border: 1px solid var(--t2-line); border-radius: 12px; background: var(--t2-bg); cursor: pointer; }
.t2-route-option input { width: 18px; height: 18px; flex: none; margin: 1px 0 0; accent-color: var(--t2-green); }
.t2-route-option span { display: grid; gap: 4px; }
.t2-route-option strong { font-size: 13px; }
.t2-route-option small { color: var(--t2-muted); font-size: 11px; }
.t2-live-map-card { gap: 14px; }
.t2-live-map-window { min-height: 520px; overflow: hidden; border: 1px solid var(--t2-line); border-radius: 13px; }
.t2-live-map-window .route-map-shell, .t2-live-map-window .route-map { height: 100%; min-height: 520px; }
.t2-live-indicator { display: inline-flex; align-items: center; gap: 7px; color: var(--t2-muted); font-size: 12px; white-space: nowrap; }
.t2-live-indicator i { width: 8px; height: 8px; border-radius: 50%; background: #22a85a; box-shadow: 0 0 0 3px rgba(34, 168, 90, .18); }
.t2-route-details { display: grid; gap: 16px; }
.t2-route-detail { gap: 18px; }
.t2-route-detail > .t2-sub { margin: 0; }
.t2-active-trip { display: grid; gap: 14px; padding-top: 16px; border-top: 1px solid var(--t2-line); }
.t2-active-trip h3 { margin: 0; color: var(--t2-ink); font-size: 16px; }
.t2-active-trip .t2-sub { margin-top: 4px; }
.t2-eta-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(175px, 1fr)); gap: 10px; }
.t2-eta-summary > span { display: grid; gap: 6px; padding: 12px; border-radius: 11px; background: var(--t2-bg); color: var(--t2-muted); font-size: 11px; }
.t2-eta-summary b { color: var(--t2-ink); font-size: 13px; }
.t2-timeline { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
.t2-timeline-stop { position: relative; display: grid; grid-template-columns: 16px minmax(0, 1fr); gap: 10px; min-height: 52px; }
.t2-timeline-stop:not(:last-child)::after { position: absolute; top: 14px; bottom: -1px; left: 6px; width: 2px; content: ''; background: var(--t2-track); }
.t2-timeline-dot { z-index: 1; width: 12px; height: 12px; margin-top: 3px; border: 2px solid #168044; border-radius: 50%; background: #fff; }
.t2-timeline-stop--done .t2-timeline-dot { background: #168044; }
.t2-timeline-stop--current .t2-timeline-dot { background: #075d35; box-shadow: 0 0 0 3px var(--t2-soft); }
.t2-timeline-stop > div { display: grid; gap: 3px; padding-bottom: 12px; }
.t2-timeline-stop strong { color: var(--t2-ink); font-size: 13px; }
.t2-timeline-stop span:not(.t2-timeline-dot), .t2-timeline-stop small { color: var(--t2-muted); font-size: 11px; }
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
.t2-qr svg, .t2-qr img { width: 84px; height: 84px; flex: none; object-fit: contain; }
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
@media (max-width: 640px) { .t2-form, .t2-details, .t2-meta { grid-template-columns: 1fr; } .t2-tiles { grid-template-columns: 1fr; } .t2-live-map-window, .t2-live-map-window .route-map-shell, .t2-live-map-window .route-map { min-height: 360px; } }
`

/* --------------------------- small pieces --------------------------- */

function QrBadge({ code, image }) {
  return (
    <div className="t2-qr">
      {image
        ? <img src={image} alt={`Truck QR code for ${code}`} />
        : <span className="t2-sub">QR image not available</span>}
      <div><p className="t2-sub">Truck QR code value</p><code>{code}</code></div>
    </div>
  )
}

function Pill({ value }) {
  const label = STATUSES.find(([status]) => status === value)?.[1] || value
  const className = label.replace(/\s+/g, '-')
  return <span className={`t2-pill t2-pill--${className}`}>{label}</span>
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

/* ---------------- BR-2: Resident & Guest route view ---------------- */

function ResidentView({ routes, tickets, selectedRouteIds, onToggleRoute, onSelectAllRoutes, onClearRoutes }) {
  const activeTickets = tickets.filter((ticket) => ticket.status === 'ACTIVE' && ticket.route)
  const selectedRoutes = routes.filter((route) => selectedRouteIds.includes(route.id))
  const mapRoutes = selectedRoutes.map((route) => {
    const activeTicket = activeTickets.find((ticket) => ticket.routeId === route.id)
    const stops = activeTicket
      ? stopsFor(activeTicket.truckDetails, activeTicket, route)
      : route.streets.map((street) => ({ ...street, state: 'pending', routeName: route.name }))
    return { id: route.id, name: route.name, stops: stops.map((stop) => ({ ...stop, routeName: route.name })) }
  })
  const mapTrucks = selectedRoutes.flatMap((route) => activeTickets
    .filter((ticket) => ticket.routeId === route.id)
    .map((ticket) => {
      const state = tripState(ticket)
      const currentStreet = state.current >= 0 ? route.streets[state.current]?.name : null
      const headline = currentStreet ? `At ${currentStreet}` : 'Started · awaiting first checkpoint'
      const position = truckPosition(ticket.truckDetails, ticket, route)
      return Array.isArray(position)
        ? { position, title: `Truck ${ticket.truckCode}`, subtitle: `${route.name} · ${headline}` }
        : null
    })
    .filter(Boolean))

  return (
    <div className="t2-route-tracking">
      <section className="t2-card t2-route-picker" aria-labelledby="route-picker-title">
        <div className="t2-route-picker-heading">
          <div>
            <h2 id="route-picker-title">Choose routes to track</h2>
            <p className="t2-sub">Select one or more routes to display on the live Home map.</p>
          </div>
          <div className="t2-actions">
            <button type="button" className="t2-link" onClick={onSelectAllRoutes} disabled={!routes.length}>Select all</button>
            <button type="button" className="t2-link" onClick={onClearRoutes} disabled={!selectedRouteIds.length}>Clear</button>
          </div>
        </div>
        {routes.length ? (
          <div className="t2-route-options">
            {routes.map((route) => {
              const truckCount = activeTickets.filter((ticket) => ticket.routeId === route.id).length
              return (
                <label key={route.id} className="t2-route-option">
                  <input
                    type="checkbox"
                    checked={selectedRouteIds.includes(route.id)}
                    onChange={() => onToggleRoute(route.id)}
                  />
                  <span><strong>{route.name}</strong><small>{truckCount ? `${truckCount} truck${truckCount === 1 ? '' : 's'} currently in route` : 'No active truck on this route'}</small></span>
                </label>
              )
            })}
          </div>
        ) : <p className="t2-sub">No routes have been added to the database yet.</p>}
      </section>

      <section className="t2-card t2-live-map-card" aria-labelledby="live-map-title">
        <div className="t2-route-picker-heading">
          <div><h2 id="live-map-title">Live collection map</h2><p className="t2-sub">Route and truck positions reflect the latest recorded trip checkpoints, not GPS.</p></div>
          <span className="t2-live-indicator"><i /> Refreshes every 30 seconds</span>
        </div>
        <div className="t2-live-map-window">
          <RouteMap routes={mapRoutes} trucks={mapTrucks} />
        </div>
        {!selectedRoutes.some((route) => route.streets.some((street) => Array.isArray(street.position))) && (
          <p className="t2-sub">Map coordinates are not available for the selected routes. Route details and recorded times are shown below.</p>
        )}
      </section>

      <section className="t2-route-details" aria-label="Route and truck details">
        {selectedRoutes.map((route) => {
          const routeTickets = activeTickets.filter((ticket) => ticket.routeId === route.id)
          return (
            <article key={route.id} className="t2-card t2-route-detail">
              <header className="t2-route-picker-heading">
                <div><h2>{route.name}</h2>{route.description && <p className="t2-sub">{route.description}</p>}</div>
                <span className={`t2-pill ${routeTickets.length ? '' : 't2-pill--Idle'}`}>{routeTickets.length ? 'Active' : 'Not dispatched'}</span>
              </header>
              {!routeTickets.length
                ? <p className="t2-sub">There is no active trip for this route. Dispatch and checkpoint times will appear here when the route starts.</p>
                : routeTickets.map((ticket) => (
                    <ActiveTripDetails key={ticket.id} ticket={ticket} route={route} tickets={tickets} />
                  ))}
            </article>
          )
        })}
        {!selectedRouteIds.length && <p className="t2-msg">Select a route above to view its map and truck details.</p>}
      </section>
    </div>
  )
}

function ActiveTripDetails({ ticket, route, tickets }) {
  const { actualTimes, estimates, sampleCount } = estimateArrivals(ticket, route, tickets)
  const nextEstimatedAt = [...estimates.values()][0]
  const remaining = formatRemaining(nextEstimatedAt)
  const stops = stopsFor(ticket.truckDetails, ticket, route)

  return (
    <section className="t2-active-trip" aria-label={`Truck ${ticket.truckCode} trip details`}>
      <div className="t2-route-picker-heading">
        <div><h3>Truck {ticket.truckCode} · {ticket.plate}</h3><p className="t2-sub">Trip {ticket.no} · {ticket.status.toLowerCase()}</p></div>
        <span className="t2-pill">In route</span>
      </div>
      <div className="t2-eta-summary">
        <span>Route started<b>{formatDateTime(ticket.routeStart)}</b></span>
        <span>Current street<b>{ticket.truckDetails.currentStreet || stops.find((stop) => stop.state === 'current')?.name || 'Awaiting first checkpoint'}</b></span>
        <span>Next estimated arrival<b>{nextEstimatedAt ? formatDateTime(nextEstimatedAt) : 'Not enough timing history'}</b></span>
        <span>Estimated time to next stop<b>{remaining || 'Unavailable'}</b></span>
      </div>
      <ol className="t2-timeline">
        {route.streets.map((street, index) => {
          const stop = stops[index]
          const actualAt = actualTimes.get(index)
          const estimatedAt = estimates.get(index)
          const arrivalText = actualAt
            ? `${stop.state === 'done' ? 'Completed' : 'Arrived'} · ${formatDateTime(actualAt)}`
            : estimatedAt
              ? `Estimated arrival · ${formatDateTime(estimatedAt)}`
              : 'Upcoming · estimate unavailable'
          const completedAt = ticket.checkpoints.find((checkpoint) => checkpoint.streetName.toLocaleLowerCase() === street.name.toLocaleLowerCase())?.completedAt
          return (
            <li key={street.id || street.name} className={`t2-timeline-stop t2-timeline-stop--${stop.state}`}>
              <span className="t2-timeline-dot" aria-hidden="true" />
              <div><strong>{street.name}</strong><span>{arrivalText}</span>{completedAt && <small>Collection finished · {formatDateTime(completedAt)}</small>}</div>
            </li>
          )
        })}
      </ol>
      <p className="t2-sub">{sampleCount
        ? `Estimates use ${sampleCount} recorded route segment${sampleCount === 1 ? '' : 's'} from this route. Actual times can vary with traffic and collection conditions.`
        : 'Estimated times will appear after trips on this route have recorded checkpoint timings.'}</p>
    </section>
  )
}

/* ------------------ BR-1: Admin QR scan & trip ticket ------------------ */

const EMPTY_TRUCK_FORM = { plate: '', id: '', type: '', driverName: '', crew: '' }

function AdminPanel({ trucks, tickets, routes, scanLog, workingId, currentUserId, onScan, onRegister, onStart, onArrive, onComplete, onStatus }) {
  const [code, setCode] = useState('')
  const [message, setMessage] = useState(null)
  const [showRegister, setShowRegister] = useState(false)
  const [form, setForm] = useState(EMPTY_TRUCK_FORM)
  const [routeId, setRouteId] = useState(routes[0]?.id || '')
  const [working, setWorking] = useState(false)

  const truck = trucks.find((t) => t.id === workingId)
  const ticket = truck && tickets.find((t) => t.truckId === truck.id && t.status === 'ACTIVE')
  const selectedRouteId = routeId || routes[0]?.id || ''
  const route = ticket?.route || routes.find((item) => item.id === selectedRouteId)
  const state = tripState(ticket)
  const stops = truck && ticket ? stopsFor(truck, ticket, route) : []
  const nextStreet = stops[state.current + 1]
  const started = Boolean(ticket && ticket.status === 'ACTIVE')

  function updateForm(e) { setForm((f) => ({ ...f, [e.target.name]: e.target.value })) }

  async function runAction(action, successText) {
    setWorking(true)
    setMessage(null)
    try {
      await action()
      setMessage({ text: successText })
    } catch (requestError) {
      setMessage({ error: true, text: requestError.message || 'The action could not be completed.' })
    } finally {
      setWorking(false)
    }
  }

  async function submitScan(e) {
    e.preventDefault()
    setWorking(true)
    try {
      const result = await onScan(code)
      setMessage({ text: `Scanned truck ${result.truck.displayId}.` })
      setCode('')
    } catch (requestError) {
      setMessage({ error: true, text: requestError.message || 'The QR code could not be verified.' })
    } finally {
      setWorking(false)
    }
  }

  async function submitRegister(e) {
    e.preventDefault()
    setWorking(true)
    try {
      const result = await onRegister(form)
      setMessage({ text: `Truck ${result.truck.displayId} registered. Its QR code is ready below.` })
      setForm(EMPTY_TRUCK_FORM)
      setShowRegister(false)
    } catch (requestError) {
      setMessage({ error: true, text: requestError.message || 'The truck could not be registered.' })
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="t2-grid">
      <div className="t2-card">
        <div>
          <h2>Scan or register a truck</h2>
          <p className="t2-sub">Your assigned trucks and trip tickets are loaded from the database. Enter the truck’s QR value to verify it.</p>
        </div>

        <form className="t2-row" onSubmit={submitScan}>
          <label className="t2-field">
            Truck QR code
            <input list="qr-codes" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter QR value" required />
            <datalist id="qr-codes">{trucks.filter((t) => t.adminId === currentUserId).map((t) => <option key={t.id} value={t.qr} />)}</datalist>
          </label>
          <button className="t2-btn t2-btn--solid" type="submit" disabled={working}>{working ? 'Checking…' : 'Scan QR'}</button>
        </form>

        {message && <p className={`t2-msg${message.error ? ' t2-msg--error' : ''}`} role={message.error ? 'alert' : 'status'}>{message.text}</p>}

        {!showRegister ? (
          <button type="button" className="t2-link" onClick={() => setShowRegister(true)}>Truck has no QR code? Register new truck</button>
        ) : (
          <form className="t2-form" onSubmit={submitRegister}>
            <label className="t2-field">Plate number<input name="plate" value={form.plate} onChange={updateForm} maxLength={20} required /></label>
            <label className="t2-field">Truck ID<input name="id" value={form.id} onChange={updateForm} maxLength={32} placeholder="e.g. B-15" required /></label>
            <label className="t2-field">Vehicle type<input name="type" value={form.type} onChange={updateForm} maxLength={80} placeholder="Compactor" required /></label>
            <label className="t2-field">Driver name<input name="driverName" value={form.driverName} onChange={updateForm} maxLength={120} /></label>
            <label className="t2-field t2-field--full">Crew details<input name="crew" value={form.crew} onChange={updateForm} maxLength={500} /></label>
            <div className="t2-actions t2-field--full">
              <button className="t2-btn t2-btn--solid" type="submit" disabled={working}>{working ? 'Registering…' : 'Register & generate QR'}</button>
              <button className="t2-btn" type="button" onClick={() => setShowRegister(false)}>Cancel</button>
            </div>
          </form>
        )}

        <div>
          <h3>QR checks this session</h3>
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
        {!truck ? (
          <>
            <h2>Trip ticket</h2>
            <p className="t2-sub">Verify an assigned truck’s QR code or register a truck to continue.</p>
          </>
        ) : (
          <>
            <div className="t2-details">
              <span>Truck ID<b>{truck.displayId}</b></span>
              <span>Plate<b>{truck.plate}</b></span>
              <span>Vehicle<b>{truck.type}</b></span>
              <span>Driver / crew<b>{truck.crew}</b></span>
              <span>Assigned admin<b>{truck.admin}</b></span>
            </div>
            <QrBadge code={truck.qr} image={truck.qrImage} />

            <label className="t2-field">Operational status
              <select value={truck.status} onChange={(e) => runAction(() => onStatus(truck.id, e.target.value), 'Truck status updated.')}>{STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            </label>

            {!ticket ? (
              <>
                <label className="t2-field">Route for this trip
                  <select value={selectedRouteId} onChange={(event) => setRouteId(event.target.value)} required>
                    <option value="">Choose a route</option>
                    {routes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <button className="t2-btn t2-btn--solid" type="button" disabled={!selectedRouteId || truck.status === 'MAINTENANCE' || working} onClick={() => runAction(() => onStart(truck.id, selectedRouteId), 'Trip ticket created and route started.')}>
                  {working ? 'Starting…' : 'Create trip ticket & start route'}
                </button>
                {truck.status === 'MAINTENANCE' && <p className="t2-sub">A truck under maintenance cannot start a trip.</p>}
              </>
            ) : (
              <>
                <div className="tracking-route-title">
                  <div><span className="t2-sub">Trip ticket · {ticket.date}</span><h2>{ticket.no}</h2></div>
                  <Pill value={truck.status} />
                </div>
                <div className="t2-details"><span>Route<b>{route?.name || 'Route not found'}</b></span></div>
                <div className="t2-actions">
                  <button className="t2-btn t2-btn--solid" type="button" disabled={!started || !nextStreet || working} onClick={() => runAction(() => onArrive(ticket.id, nextStreet.name), `Arrival at ${nextStreet.name} recorded.`)}>
                    {nextStreet ? `Record arrival: ${nextStreet.name}` : 'All route streets recorded'}
                  </button>
                  <button className="t2-btn" type="button" disabled={!started || working} onClick={() => runAction(() => onComplete(ticket.id), 'Route completion recorded.')}>Record route completion</button>
                </div>
                <div className="t2-meta">
                  <span>Route start<b>{fmtTime(ticket.routeStart)}</b></span>
                  <span>Route completion<b>{fmtTime(ticket.routeEnd)}</b></span>
                </div>
                <ProgressSegments done={state.done} total={ticket.total} />
                <StopList stops={stops} />
              </>
            )}
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
        <h2>Database trip and fleet filters</h2>
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
              {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="t2-tiles">
        <div className="t2-tile"><span>Active vehicles</span><strong>{trucks.filter((t) => t.status === 'ACTIVE').length}</strong></div>
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
                const ticket = tickets.find((t) => t.truckId === truck.id && t.date === new Date().toLocaleDateString('en-CA'))
                  || tickets.find((t) => t.truckId === truck.id)
                const state = tripState(ticket)
                const streets = ticket?.route?.streets || []
                const currentStreet = state.current >= 0 ? streets[state.current]?.name : state.arrival === 'Completed' ? 'Route completed' : truck.currentStreet || '—'
                return (
                  <tr key={truck.id}>
                    <td>{truck.displayId}</td><td>{truck.plate}</td><td>{truck.admin}</td><td><Pill value={truck.status} /></td>
                    <td>{ticket?.no ?? '—'}</td>
                    <td>{currentStreet}</td>
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
          <div><h2>Trip history & route performance</h2><p className="t2-sub">{history.length} database trip ticket{history.length === 1 ? '' : 's'} match the filters.</p></div>
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

export default function TrackingPage() {
  const { user, status: authStatus } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [view, setView] = useState('resident')
  const [trucks, setTrucks] = useState([])
  const [qrImages, setQrImages] = useState({})
  const [routes, setRoutes] = useState([])
  const [tickets, setTickets] = useState([])
  const [selectedRouteIds, setSelectedRouteIds] = useState(null)
  const [scanLog, setScanLog] = useState([])
  const [workingId, setWorkingId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (authStatus === 'loading') return
    setError('')
    try {
      const tripsRequest = isAdmin
        ? authenticatedRequest('/trips?limit=100')
        : publicRequest('/trips/public')
      const [truckResponse, routeResponse, tripResponse] = await Promise.all([
        isAdmin ? authenticatedRequest('/trucks/manage?limit=100') : publicRequest('/trucks?limit=100'),
        publicRequest('/routes'),
        tripsRequest,
      ])
      const normalizedTickets = (tripResponse.data || []).map(normalizeTicket)
      const normalizedRoutes = (routeResponse.data || []).map(normalizeRoute)
      setTickets(normalizedTickets)
      setRoutes(normalizedRoutes)
      setSelectedRouteIds((current) => current === null
        ? normalizedRoutes.map((route) => route.id)
        : current.filter((id) => normalizedRoutes.some((route) => route.id === id)))
      setTrucks((truckResponse.data || []).map((truck) => ({
        ...normalizeTruck(truck, normalizedTickets),
        qrImage: qrImages[truck.id] || '',
      })))
    } catch (requestError) {
      setError(requestError.message || 'Tracking data could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [authStatus, isAdmin, qrImages])

  useEffect(() => {
    Promise.resolve().then(refresh)
    const timer = window.setInterval(refresh, 30000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const tabs = [
    { id: 'resident', label: 'Route map' },
    ...(isAdmin ? [{ id: 'tickets', label: 'Trip tickets & QR' }] : []),
    ...(user ? [{ id: 'fleet', label: 'Fleet monitoring' }] : []),
  ]
  const activeView = tabs.some((t) => t.id === view) ? view : 'resident'
  const visibleRouteIds = selectedRouteIds || routes.map((route) => route.id)

  function toggleRoute(routeId) {
    setSelectedRouteIds((current) => {
      const selected = current || routes.map((route) => route.id)
      return selected.includes(routeId)
        ? selected.filter((id) => id !== routeId)
        : [...selected, routeId]
    })
  }

  async function handleScan(raw) {
    const { data } = await authenticatedRequest(`/trucks/qr/${encodeURIComponent(raw.trim())}`)
    const truck = trucks.find((item) => item.id === data.id)
    if (!truck) throw new Error('The scanned truck is not in the current fleet list. Refresh and try again.')
    if (truck.adminId !== user.id) throw new Error('Only the administrator assigned to this truck can record its trips.')
    setQrImages((current) => ({ ...current, [truck.id]: data.qrCode }))
    setWorkingId(truck.id)
    const activeTrip = tickets.find((ticket) => ticket.truckId === truck.id && ticket.status === 'ACTIVE')
    setScanLog((current) => [{
      time: new Date().toISOString(),
      truckId: truck.displayId,
      event: 'QR code verified',
      ticket: activeTrip?.no || 'No active trip',
    }, ...current])
    return { truck }
  }

  async function handleRegister(form) {
    const body = {
      truckId: form.id.trim().toUpperCase(),
      plateNumber: form.plate.trim().toUpperCase(),
      vehicleType: form.type.trim(),
      adminId: user.id,
      ...(form.driverName.trim() ? { driverName: form.driverName.trim() } : {}),
      ...(form.crew.trim() ? { crew: form.crew.trim() } : {}),
    }
    const { data } = await authenticatedRequest('/trucks', { method: 'POST', body })
    setQrImages((current) => ({ ...current, [data.id]: data.qrCode }))
    await refresh()
    const truck = normalizeTruck(data, tickets)
    truck.qrImage = data.qrCode
    setWorkingId(truck.id)
    return { truck }
  }

  async function startRoute(truckId, routeId) {
    await authenticatedRequest('/trips', { method: 'POST', body: { truckId, routeId } })
    await refresh()
  }

  async function recordArrival(tripId, streetName) {
    await authenticatedRequest(`/trips/${tripId}/checkpoints`, {
      method: 'POST',
      body: { streetName, completed: false },
    })
    await refresh()
  }

  async function completeRoute(tripId) {
    await authenticatedRequest(`/trips/${tripId}/complete`, { method: 'POST', body: {} })
    await refresh()
  }

  async function setStatus(truckId, nextStatus) {
    await authenticatedRequest(`/trucks/${truckId}`, {
      method: 'PUT',
      body: { status: nextStatus },
    })
    await refresh()
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

        {error && <p className="t2-msg t2-msg--error" role="alert">{error}</p>}
        {loading && <p className="t2-msg" role="status">Loading live truck and trip data…</p>}
        {tabs.length > 1 && (
          <div className="t2-tabs" role="group" aria-label="Tracking views" style={{ marginBottom: 20 }}>
            {tabs.map((t) => (
              <button key={t.id} type="button" className="t2-tab" aria-pressed={activeView === t.id} onClick={() => setView(t.id)}>{t.label}</button>
            ))}
          </div>
        )}

        {activeView === 'resident' && (
          <ResidentView
            routes={routes}
            tickets={tickets}
            selectedRouteIds={visibleRouteIds}
            onToggleRoute={toggleRoute}
            onSelectAllRoutes={() => setSelectedRouteIds(routes.map((route) => route.id))}
            onClearRoutes={() => setSelectedRouteIds([])}
          />
        )}
        {activeView === 'tickets' && (
          <AdminPanel
            trucks={trucks} tickets={tickets} routes={routes} scanLog={scanLog} workingId={workingId} currentUserId={user.id}
            onScan={handleScan} onRegister={handleRegister} onStart={startRoute}
            onArrive={recordArrival} onComplete={completeRoute} onStatus={setStatus}
          />
        )}
        {activeView === 'fleet' && <FleetPanel trucks={trucks} tickets={tickets} />}
      </main>
    </div>
  )
}