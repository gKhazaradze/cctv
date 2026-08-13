import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { Camera, City } from '../types'

// Leaflet plus its stylesheet is a sizeable chunk that is useless until the map
// panel is actually open, so it loads on demand.
const WorldMap = lazy(() =>
  import('./WorldMap').then((m) => ({ default: m.WorldMap })),
)

const STORAGE_KEY = 'citywatch:mapHeight'
const DEFAULT_HEIGHT = 320
const MIN_HEIGHT = 200
/** Leaves room for the toolbar and a sliver of the camera grid below. */
const VIEWPORT_MARGIN = 160
const KEYBOARD_STEP = 24

function maxHeight(): number {
  if (typeof window === 'undefined') return 900
  return Math.max(MIN_HEIGHT + 40, window.innerHeight - VIEWPORT_MARGIN)
}

function clamp(value: number): number {
  return Math.min(Math.max(value, MIN_HEIGHT), maxHeight())
}

function readStoredHeight(): number {
  if (typeof window === 'undefined') return DEFAULT_HEIGHT
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_HEIGHT
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? clamp(parsed) : DEFAULT_HEIGHT
  } catch {
    // Private browsing and blocked storage both throw here; the map still works.
    return DEFAULT_HEIGHT
  }
}

interface Props {
  cities: City[]
  cameras: Camera[]
  selectedCityId: string
  onSelectCity: (cityId: string) => void
  onSelectCamera: (camera: Camera) => void
}

/**
 * The map, with a drag handle so it can be grown to fill most of the window.
 *
 * The chosen height persists, because someone who wants a big map wants it on
 * every visit, not once. Leaflet is told to re-measure on every size change from
 * inside WorldMap, so tiles never end up rendered against a stale viewport.
 */
export function MapPanel({ cities, cameras, selectedCityId, onSelectCity, onSelectCamera }: Props) {
  const [height, setHeight] = useState(readStoredHeight)
  const [dragging, setDragging] = useState(false)
  const dragState = useRef<{ startY: number; startHeight: number } | null>(null)

  const persist = useCallback((value: number) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(value))
    } catch {
      // Not being able to remember the size is not worth surfacing.
    }
  }, [])

  // A window that shrinks below the stored height would otherwise leave the map
  // taller than the viewport with no way back except dragging.
  useEffect(() => {
    const onResize = () => setHeight((h) => clamp(h))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    dragState.current = { startY: event.clientY, startHeight: height }
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragState.current
    if (!state) return
    setHeight(clamp(state.startHeight + (event.clientY - state.startY)))
  }

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return
    dragState.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    persist(height)
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === 'ArrowDown' ? KEYBOARD_STEP : event.key === 'ArrowUp' ? -KEYBOARD_STEP : 0

    let next: number | null = null
    if (step !== 0) next = clamp(height + step)
    else if (event.key === 'Home') next = MIN_HEIGHT
    else if (event.key === 'End') next = maxHeight()
    if (next === null) return

    event.preventDefault()
    setHeight(next)
    persist(next)
  }

  return (
    <section className="map-panel" aria-label="Map of cameras">
      <div className="map-panel__viewport" style={{ height }}>
        <Suspense fallback={<div className="map map--loading">Loading map…</div>}>
          <WorldMap
            cities={cities}
            cameras={cameras}
            selectedCityId={selectedCityId}
            onSelectCity={onSelectCity}
            onSelectCamera={onSelectCamera}
          />
        </Suspense>
      </div>

      <div
        className={`map-resize${dragging ? ' map-resize--active' : ''}`}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize map — drag, or use arrow keys"
        aria-valuenow={Math.round(height)}
        aria-valuemin={MIN_HEIGHT}
        aria-valuemax={Math.round(maxHeight())}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        <span className="map-resize__grip" aria-hidden />
      </div>
    </section>
  )
}
