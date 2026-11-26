import { useEffect } from 'react'
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap, ZoomControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const ROUTE_STYLE = { color: '#1e8e4c', weight: 5, opacity: 0.9 }
const ROUTE_COLORS = ['#1e8e4c', '#2468a2', '#b46b13', '#7750a3', '#ba4656']
const TRUCK_COLORS = ['#075d35', '#174e8c', '#9a5510', '#65408f', '#9c3042']
const REPORT_COLORS = {
  urgent: '#c62828',
  pending: '#e1b52f',
  assigned: '#2778bd',
  'in-progress': '#169b83',
  completed: '#168044',
  neutral: '#718574',
}
const STOP_STYLES = {
  done: { color: '#ffffff', weight: 3, fillColor: '#168044', fillOpacity: 1 },
  current: { color: '#ffffff', weight: 3, fillColor: '#075d35', fillOpacity: 1 },
  pending: { color: '#168044', weight: 3, fillColor: '#ffffff', fillOpacity: 1 },
}
const STATE_LABEL = { done: 'Completed', current: 'Being serviced now', pending: 'Upcoming' }

function MapResizeHandler() {
  const map = useMap()

  useEffect(() => {
    let frame = 0
    const invalidateSize = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        map.invalidateSize({ pan: false, debounceMoveend: true })
      })
    }
    const observer = new ResizeObserver(invalidateSize)

    observer.observe(map.getContainer())
    invalidateSize()

    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [map])

  return null
}

// Re-frames the map whenever a different route is shown.
function FitRoute({ positions }) {
  const map = useMap()
  const key = positions.map((p) => p.join(',')).join('|')

  useEffect(() => {
    if (positions.length > 1) map.fitBounds(positions, { padding: [36, 36], maxZoom: 17 })
    else if (positions.length === 1) map.setView(positions[0], 15)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key])

  return null
}

export default function RouteMap({ stops = [], truck = null, routes = [], trucks = [], reports = [] }) {
  const mapRoutes = routes.length ? routes : [{ id: 'default-route', stops }]
  const mappedRoutes = mapRoutes.map((route, index) => ({
    ...route,
    color: ROUTE_COLORS[index % ROUTE_COLORS.length],
    stops: (route.stops || []).filter((stop) => Array.isArray(stop.position)),
  }))
  const mappedReports = reports.filter((report) =>
    Array.isArray(report.position) &&
    report.position.length >= 2 &&
    report.position.every(Number.isFinite) &&
    Math.abs(report.position[0]) <= 90 &&
    Math.abs(report.position[1]) <= 180,
  )
  const mappedStops = mappedRoutes.flatMap((route) => route.stops.map((stop) => ({ ...stop, routeId: route.id })))
  const positions = [...mappedStops.map((stop) => stop.position), ...mappedReports.map((report) => report.position)]
  const routeTrucks = trucks.length ? trucks : truck ? [truck] : []

  return (
    <div className="route-map-shell" role="region" aria-label="Interactive collection route map">
      <MapContainer
        className="route-map"
        center={[14.6987, 121.1095]}
        zoom={15}
        minZoom={12}
        maxZoom={19}
        scrollWheelZoom={false}
        attributionControl={false}
        zoomControl={false}
      >
        <MapResizeHandler />
        <FitRoute positions={positions} />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
        {mappedRoutes.map((route) => {
          const routePositions = route.stops.map((stop) => stop.position)
          return routePositions.length > 1
            ? <Polyline key={route.id} positions={routePositions} pathOptions={{ ...ROUTE_STYLE, color: route.color }} />
            : null
        })}
        {mappedStops.map((stop) => (
          <CircleMarker
            key={`${stop.routeId}-${stop.id || stop.name}`}
            center={stop.position}
            radius={stop.state === 'current' ? 9 : 7}
            pathOptions={STOP_STYLES[stop.state] || STOP_STYLES.pending}
          >
            <Tooltip>{stop.routeName ? `${stop.routeName} · ` : ''}{stop.name} · {STATE_LABEL[stop.state] || STATE_LABEL.pending}</Tooltip>
          </CircleMarker>
        ))}
        {mappedReports.map((report) => (
          <CircleMarker
            key={`report-${report.id}`}
            center={report.position}
            radius={9}
            pathOptions={{
              color: '#ffffff',
              weight: 3,
              fillColor: REPORT_COLORS[report.status] || REPORT_COLORS.neutral,
              fillOpacity: 1,
            }}
          >
            <Tooltip>{report.title} · {report.referenceNo}</Tooltip>
          </CircleMarker>
        ))}
        {routeTrucks.map((routeTruck, index) => (
          <CircleMarker
            key={`${routeTruck.title}-${index}`}
            center={routeTruck.position}
            radius={11}
            pathOptions={{ color: '#ffffff', weight: 4, fillColor: TRUCK_COLORS[index % TRUCK_COLORS.length], fillOpacity: 1 }}
          >
            <Tooltip permanent direction="right" offset={[12, 0]} opacity={1}>
              <span className="map-route-tooltip">
                <strong>{routeTruck.title}</strong>
                <small>{routeTruck.subtitle}</small>
              </span>
            </Tooltip>
          </CircleMarker>
        ))}
        <ZoomControl position="topright" />
      </MapContainer>
      <a
        className="map-attribution"
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
      >
        © OpenStreetMap contributors
      </a>
    </div>
  )
}