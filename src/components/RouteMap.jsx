import { useEffect } from 'react'
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap, ZoomControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

// Defaults keep <RouteMap /> on the Home page working exactly as before.
const DEFAULT_STOPS = [
  { name: 'Bagong Silangan north checkpoint', position: [14.7016, 121.1122], state: 'done' },
  { name: 'Bagong Silangan central checkpoint', position: [14.699, 121.1074], state: 'current' },
  { name: 'Bagong Silangan south checkpoint', position: [14.6958, 121.112], state: 'pending' },
  { name: 'Bagong Silangan east checkpoint', position: [14.6936, 121.1106], state: 'pending' },
]
const DEFAULT_TRUCK = { position: [14.699, 121.1074], title: 'Route B-12', subtitle: 'Next: Bagong Silangan · ETA 2 mins' }

const ROUTE_STYLE = { color: '#1e8e4c', weight: 5, opacity: 0.9 }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key])

  return null
}

export default function RouteMap({ stops = DEFAULT_STOPS, truck = DEFAULT_TRUCK }) {
  const positions = stops.map((stop) => stop.position)

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
        <Polyline positions={positions} pathOptions={ROUTE_STYLE} />
        {stops.map((stop) => (
          <CircleMarker
            key={stop.name}
            center={stop.position}
            radius={stop.state === 'current' ? 9 : 7}
            pathOptions={STOP_STYLES[stop.state] || STOP_STYLES.pending}
          >
            <Tooltip>{stop.name} · {STATE_LABEL[stop.state] || STATE_LABEL.pending}</Tooltip>
          </CircleMarker>
        ))}
        {truck && (
          <CircleMarker
            center={truck.position}
            radius={11}
            pathOptions={{ color: '#ffffff', weight: 4, fillColor: '#075d35', fillOpacity: 1 }}
          >
            <Tooltip permanent direction="right" offset={[12, 0]} opacity={1}>
              <span className="map-route-tooltip">
                <strong>{truck.title}</strong>
                <small>{truck.subtitle}</small>
              </span>
            </Tooltip>
          </CircleMarker>
        )}
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