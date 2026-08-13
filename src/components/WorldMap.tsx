import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Camera, City } from '../types'

interface Props {
  cities: City[]
  /** Every camera worth plotting, not just the selected city's. */
  cameras: Camera[]
  selectedCityId: string
  onSelectCity: (cityId: string) => void
  onSelectCamera: (camera: Camera) => void
}

/** Dark raster basemap — free to use with attribution, and no API key needed. */
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

function cameraIcon(dimmed: boolean): L.DivIcon {
  // A div icon avoids Leaflet's default marker PNGs, which need bundler-specific
  // asset wiring to resolve correctly.
  return L.divIcon({
    className: `map-pin${dimmed ? ' map-pin--dim' : ''}`,
    html: '<span class="map-pin__dot"></span>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

export function WorldMap({ cities, cameras, selectedCityId, onSelectCity, onSelectCamera }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)

  // Latest callbacks, so marker handlers never go stale but the map is not torn
  // down and rebuilt every render.
  const handlers = useRef({ onSelectCity, onSelectCamera })
  handlers.current = { onSelectCity, onSelectCamera }

  // Rebound on every render; the control created at mount calls through this.
  const fitAllRef = useRef<() => void>(() => {})

  // Fly to a city only when the selection actually changes — otherwise an
  // unrelated re-render (toggling a filter, resizing) would yank the view back
  // and undo a deliberate "Fit all".
  const lastFlownCity = useRef<string | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      worldCopyJump: true,
    }).setView([30, 15], 2)

    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)

    const fitControl = new L.Control({ position: 'topright' })
    fitControl.onAdd = () => {
      const button = L.DomUtil.create('button', 'map-fit')
      button.type = 'button'
      button.textContent = 'Fit all'
      button.title = 'Zoom out to show every camera'
      // Without this, clicking the button also pans/zooms the map underneath.
      L.DomEvent.disableClickPropagation(button)
      L.DomEvent.on(button, 'click', (event) => {
        L.DomEvent.stop(event)
        fitAllRef.current()
      })
      return button
    }
    fitControl.addTo(map)

    mapRef.current = map

    // The panel is user-resizable, so the container changes size without any
    // window resize event. Leaflet caches viewport dimensions and would keep
    // painting tiles against the old size until told otherwise.
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => mapRef.current?.invalidateSize())
    })
    observer.observe(containerRef.current)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  // Redraw markers whenever the selection or camera set changes.
  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return

    layer.clearLayers()

    for (const city of cities) {
      if (!city.coords) continue
      const isSelected = city.id === selectedCityId
      const marker = L.circleMarker(city.coords, {
        radius: isSelected ? 10 : 7,
        color: isSelected ? '#6ee7b7' : '#64748b',
        weight: 2,
        fillColor: isSelected ? '#10b981' : '#334155',
        fillOpacity: 0.85,
      })
      marker.bindTooltip(`${city.name}, ${city.country}`, { direction: 'top' })
      marker.on('click', () => handlers.current.onSelectCity(city.id))
      marker.addTo(layer)
    }

    for (const camera of cameras) {
      if (!camera.coords) continue
      const inSelectedCity = camera.cityId === selectedCityId
      const marker = L.marker(camera.coords, {
        icon: cameraIcon(!inSelectedCity),
        title: camera.name,
        // Keep the focused city's cameras clickable above the dimmed ones.
        zIndexOffset: inSelectedCity ? 400 : 0,
        opacity: 1,
      })
      marker.bindTooltip(camera.name, { direction: 'top' })
      marker.on('click', () => handlers.current.onSelectCamera(camera))
      marker.addTo(layer)
    }
  }, [cities, cameras, selectedCityId])

  // Keep "Fit all" pointed at the current data.
  useEffect(() => {
    fitAllRef.current = () => {
      const map = mapRef.current
      if (!map) return

      const points: [number, number][] = [
        ...cities.filter((c) => c.coords).map((c) => c.coords as [number, number]),
        ...cameras.filter((c) => c.coords).map((c) => c.coords as [number, number]),
      ]
      if (points.length === 0) return

      // Deliberately clears the "already flown here" marker so selecting the
      // same city again will re-frame it.
      lastFlownCity.current = null
      map.flyToBounds(L.latLngBounds(points).pad(0.2), { duration: 0.8, maxZoom: 11 })
    }
  }, [cities, cameras])

  useEffect(() => {
    const map = mapRef.current
    if (!map || lastFlownCity.current === selectedCityId) return

    const city = cities.find((c) => c.id === selectedCityId)
    if (!city) return
    lastFlownCity.current = selectedCityId

    // "All" selected: pull back to a whole-earth view framing every camera.
    if (city.kind === 'all') {
      const worldPoints = [
        ...cities.filter((c) => c.coords).map((c) => c.coords as [number, number]),
        ...cameras.filter((c) => c.coords).map((c) => c.coords as [number, number]),
      ]
      if (worldPoints.length > 0) {
        map.flyToBounds(L.latLngBounds(worldPoints).pad(0.25), { duration: 0.8, maxZoom: 4 })
      } else {
        map.flyTo([20, 0], 2, { duration: 0.8 })
      }
      return
    }

    const points = cameras
      .filter((c) => c.cityId === selectedCityId && c.coords)
      .map((c) => c.coords as [number, number])

    if (points.length > 1) {
      map.flyToBounds(L.latLngBounds(points).pad(0.35), { duration: 0.8, maxZoom: 14 })
    } else if (points.length === 1) {
      map.flyTo(points[0], 13, { duration: 0.8 })
    } else if (city.coords) {
      map.flyTo(city.coords, 12, { duration: 0.8 })
    }
    // A custom group with no located cameras: leave the view where it is.
  }, [selectedCityId, cities, cameras])

  return <div className="map" ref={containerRef} role="application" aria-label="Camera map" />
}
