import { useEffect } from 'react'
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap, ZoomControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const ROUTE_POINTS = [
  [14.7016, 121.1122],
  [14.7005, 121.1104],
  [14.699, 121.1074],
  [14.6976, 121.1106],
  [14.6958, 121.112],
  [14.6936, 121.1106],
]

const CHECKPOINTS = [
  { position: ROUTE_POINTS[0], name: 'Bagong Silangan north checkpoint' },
  { position: ROUTE_POINTS[2], name: 'Bagong Silangan central checkpoint' },
  { position: ROUTE_POINTS[4], name: 'Bagong Silangan south checkpoint' },
  { position: ROUTE_POINTS[5], name: 'Bagong Silangan east checkpoint' },
]

const TRUCK_POSITION = ROUTE_POINTS[2]
const STOP_STYLE = { color: '#ffffff', weight: 3, fillColor: '#168044', fillOpacity: 1 }
const ROUTE_STYLE = { color: '#1e8e4c', weight: 5, opacity: 0.9 }

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

export default function RouteMap() {
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
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <Polyline positions={ROUTE_POINTS} pathOptions={ROUTE_STYLE} />
        {CHECKPOINTS.map((checkpoint) => (
          <CircleMarker
            key={checkpoint.name}
            center={checkpoint.position}
            radius={7}
            pathOptions={STOP_STYLE}
          >
            <Tooltip>{checkpoint.name}</Tooltip>
          </CircleMarker>
        ))}
        <CircleMarker
          center={TRUCK_POSITION}
          radius={11}
          pathOptions={{ ...STOP_STYLE, color: '#ffffff', weight: 4, fillColor: '#075d35' }}
        >
          <Tooltip permanent direction="right" offset={[12, 0]} opacity={1}>
            <span className="map-route-tooltip">
              <strong>Route B-12</strong>
              <small>Next: Bagong Silangan · ETA 2 mins</small>
            </span>
          </Tooltip>
        </CircleMarker>
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
