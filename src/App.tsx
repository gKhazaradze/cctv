import { useCallback, useMemo, useRef, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { CameraGrid } from './components/CameraGrid'
import { MapPanel } from './components/MapPanel'
import { Theater } from './components/Theater'
import { AddCameraDialog } from './components/AddCameraDialog'
import { cities as builtInCities, flagEmoji } from './data/cities'
import { cameras as registryCameras, isEmbeddable } from './data/cameras'
import { collections, collectionCameras } from './data/collections'
import { allGroup, ALL_GROUP_ID } from './data/groups'
import { formatLocalDate, formatLocalTime, offsetFromViewer, useNow } from './lib/time'
import { daylightPhase, phaseIcon, phaseLabel } from './lib/sun'
import { useCustomCameras } from './hooks/useCustomCameras'
import { useFavorites } from './hooks/useFavorites'
import { CUSTOM_CITY_ID, customCity, toCamera, type CustomCameraInput } from './lib/customCameras'
import { floatFavorites, sortCameras, SORT_OPTIONS, type SortKey } from './lib/sortCameras'
import type { Camera } from './types'

const WALL_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '4', value: 4 },
  { label: '8', value: 8 },
  { label: 'All', value: Number.POSITIVE_INFINITY },
]

export default function App() {
  const now = useNow(30_000)

  const { cameras: customInputs, upsert, remove } = useCustomCameras()
  const { favorites, isFavorite, toggle: toggleFavorite, count: favoriteCount } = useFavorites()

  // Open on Amsterdam — the built-in city that can actually show the most feeds,
  // so the first screen is a working wall rather than "watch at the source" cards.
  const [selectedCityId, setSelectedCityId] = useState('amsterdam')
  const [wallLimit, setWallLimit] = useState(4)
  const [embeddableOnly, setEmbeddableOnly] = useState(false)
  const [mapOpen, setMapOpen] = useState(true)
  const [sortBy, setSortBy] = useState<SortKey>('grouped')
  const [shuffleSeed, setShuffleSeed] = useState(() => Math.random())
  // Favourites lead the grid by default; this switches that priority off.
  const [favoritesOnTop, setFavoritesOnTop] = useState(true)
  const [theaterId, setTheaterId] = useState<string | null>(null)
  // null = closed; {} = adding fresh; a camera = editing it.
  const [dialog, setDialog] = useState<{ editing?: CustomCameraInput } | null>(null)

  // The wall setting to restore when leaving the "All" view — entering All bumps
  // the wall to play everything, so we put the user's own choice back afterward
  // rather than leaving every other place stuck on "play all".
  const wallLimitRef = useRef(wallLimit)
  wallLimitRef.current = wallLimit
  const wallBeforeAll = useRef(wallLimit)

  // Custom cameras become normal Camera objects under a synthetic city, so the
  // grid, map, theater, sidebar and time/light readouts all treat them like any
  // built-in — no special-casing downstream.
  const customCameras = useMemo(() => customInputs.map(toCamera), [customInputs])

  const allCameras = useMemo(
    () => [...registryCameras, ...collectionCameras, ...customCameras],
    [customCameras],
  )

  const cities = useMemo(() => {
    const synthetic = customCity(customCameras.length)
    const base = [allGroup, ...builtInCities, ...collections]
    return synthetic ? [...base, synthetic] : base
  }, [customCameras.length])

  const city = cities.find((c) => c.id === selectedCityId) ?? cities[0]

  const cityCameras = useMemo(
    // The "All" group owns no cameras of its own — it shows everything.
    () => (city.kind === 'all' ? allCameras : allCameras.filter((c) => c.cityId === city.id)),
    [allCameras, city.id, city.kind],
  )

  const filteredCameras = useMemo(
    () => (embeddableOnly ? cityCameras.filter(isEmbeddable) : cityCameras),
    [cityCameras, embeddableOnly],
  )

  const groupNameById = useMemo(() => {
    const map = new Map(cities.map((c) => [c.id, c.name]))
    return (cityId: string) => map.get(cityId) ?? cityId
  }, [cities])

  // Re-sort at most once a minute for the daylight ordering (it drifts with the
  // sun); never re-sort on the clock tick for the other, time-independent modes.
  const daytimeTick = sortBy === 'daytime' ? Math.floor(now.getTime() / 60_000) : 0

  const visibleCameras = useMemo(
    () => {
      const sorted = sortCameras(filteredCameras, sortBy, {
        groupName: groupNameById,
        now,
        shuffleSeed,
      })
      return favoritesOnTop ? floatFavorites(sorted, isFavorite) : sorted
    },
    // `now` is intentionally excluded; `daytimeTick` gates time-based re-sorts.
    // `favorites` (the Set) drives isFavorite, so re-float when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredCameras, sortBy, shuffleSeed, groupNameById, daytimeTick, favoritesOnTop, favorites],
  )

  // The map plots every city's cameras, not just the selected one's — a map you
  // can grow to fill the window is only worth growing if there is more to see.
  const mapCameras = useMemo(
    () => (embeddableOnly ? allCameras.filter(isEmbeddable) : allCameras),
    [allCameras, embeddableOnly],
  )

  const embeddableCount = cityCameras.filter(isEmbeddable).length

  // The theater walks the list the viewer can actually see, in its shown order.
  const theaterIndex = visibleCameras.findIndex((c) => c.id === theaterId)
  const theaterCamera = theaterIndex >= 0 ? visibleCameras[theaterIndex] : undefined

  const handleSortChange = useCallback((key: SortKey) => {
    setSortBy(key)
    // Re-picking Shuffle from the control reseeds for a fresh order.
    if (key === 'shuffle') setShuffleSeed(Math.random())
  }, [])

  const step = useCallback(
    (delta: number) => {
      if (visibleCameras.length === 0 || theaterIndex < 0) return
      const next =
        (theaterIndex + delta + visibleCameras.length) % visibleCameras.length
      setTheaterId(visibleCameras[next].id)
    },
    [theaterIndex, visibleCameras],
  )

  const handleSelectCity = useCallback((cityId: string) => {
    setTheaterId(null)
    setSelectedCityId((prev) => {
      const toAll = cityId === ALL_GROUP_ID
      const fromAll = prev === ALL_GROUP_ID
      // Entering All: remember the current wall and switch to "play everything".
      if (toAll && !fromAll) {
        wallBeforeAll.current = wallLimitRef.current
        setWallLimit(Number.POSITIVE_INFINITY)
      } else if (!toAll && fromAll) {
        // Leaving All: restore whatever the wall was before.
        setWallLimit(wallBeforeAll.current)
      }
      return cityId
    })
  }, [])

  const handleSelectCamera = useCallback((camera: Camera) => {
    // A pin on the map may belong to a group that is not currently open; follow
    // it rather than opening a theater the grid behind it does not contain.
    setSelectedCityId((prev) => {
      // Following a pin also leaves the All view, so restore the wall setting.
      if (prev === ALL_GROUP_ID) setWallLimit(wallBeforeAll.current)
      return camera.cityId
    })
    setTheaterId(camera.id)
  }, [])

  const handleSaveCamera = useCallback(
    (camera: CustomCameraInput) => {
      upsert(camera)
      setDialog(null)
      setSelectedCityId(CUSTOM_CITY_ID)
    },
    [upsert],
  )

  const handleRemoveCamera = useCallback(
    (id: string) => {
      remove(id)
      setTheaterId((current) => (current === id ? null : current))
    },
    [remove],
  )

  // Collections and the "My cameras" group have no single location or zone, so
  // there is no meaningful clock or sun position; guard every read.
  const phase = city.coords ? daylightPhase(now, city.coords[0], city.coords[1]) : null
  const offset = city.timeZone ? offsetFromViewer(now, city.timeZone) : null

  return (
    <div className="app">
      <Sidebar
        cities={cities}
        cameras={allCameras}
        selectedCityId={selectedCityId}
        now={now}
        onSelectCity={handleSelectCity}
      />

      <main className="main">
        <header className="city-header">
          <div className="city-header__identity">
            <span className="city-header__flag" aria-hidden>
              {city.icon ?? (city.isCustomGroup ? '📷' : flagEmoji(city.countryCode))}
            </span>
            <div>
              <h2 className="city-header__name">
                {city.name}
                {city.localName && city.localName !== city.name && (
                  <span className="city-header__local"> {city.localName}</span>
                )}
              </h2>
              <p className="city-header__blurb">{city.blurb}</p>
            </div>
          </div>

          <div className="city-header__stats">
            {city.timeZone && (
              <div className="stat">
                <span className="stat__value">{formatLocalTime(now, city.timeZone)}</span>
                <span className="stat__label">
                  {formatLocalDate(now, city.timeZone)}
                  {offset ? ` · ${offset}` : ' · your time'}
                </span>
              </div>
            )}
            {phase && (
              <div className="stat">
                <span className={`stat__value stat__value--${phase}`}>
                  {phaseIcon[phase]} {phaseLabel[phase]}
                </span>
                <span className="stat__label">local light</span>
              </div>
            )}
            <div className="stat">
              <span className="stat__value">
                {embeddableCount}
                <span className="stat__of">/{cityCameras.length}</span>
              </span>
              <span className="stat__label">playable here</span>
            </div>
          </div>
        </header>

        <div className="toolbar">
          <div className="toolbar__group">
            <span className="toolbar__label">Live wall</span>
            <div className="segmented" role="group" aria-label="How many feeds start automatically">
              {WALL_OPTIONS.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  className={`segmented__item${wallLimit === option.value ? ' segmented__item--on' : ''}`}
                  onClick={() => setWallLimit(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {visibleCameras.length > 1 && (
            <div className="toolbar__group">
              <label className="toolbar__label" htmlFor="sort-select">
                Sort
              </label>
              <select
                id="sort-select"
                className="select"
                value={sortBy}
                onChange={(event) => handleSortChange(event.target.value as SortKey)}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              {sortBy === 'shuffle' && (
                <button
                  type="button"
                  className="btn btn--ghost btn--icon"
                  onClick={() => setShuffleSeed(Math.random())}
                  title="Shuffle again"
                  aria-label="Shuffle again"
                >
                  ↻
                </button>
              )}
              {favoriteCount > 0 && (
                <button
                  type="button"
                  className={`btn btn--ghost btn--toggle${favoritesOnTop ? ' btn--toggle-on' : ''}`}
                  aria-pressed={favoritesOnTop}
                  onClick={() => setFavoritesOnTop((v) => !v)}
                  title={
                    favoritesOnTop
                      ? 'Favorites are pinned to the top — click to sort them normally'
                      : 'Favorites sort normally — click to pin them to the top'
                  }
                >
                  {favoritesOnTop ? '★' : '☆'} Favorites first
                </button>
              )}
            </div>
          )}

          <label className="toggle">
            <input
              type="checkbox"
              checked={embeddableOnly}
              onChange={(event) => setEmbeddableOnly(event.target.checked)}
            />
            <span>Playable only</span>
          </label>

          <button
            type="button"
            className="btn btn--ghost toolbar__map-toggle"
            onClick={() => setMapOpen((open) => !open)}
            aria-expanded={mapOpen}
          >
            {mapOpen ? 'Hide map' : 'Show map'}
          </button>

          <button type="button" className="btn btn--primary" onClick={() => setDialog({})}>
            + Add camera
          </button>
        </div>

        {mapOpen && (
          <MapPanel
            cities={cities}
            cameras={mapCameras}
            selectedCityId={selectedCityId}
            onSelectCity={handleSelectCity}
            onSelectCamera={handleSelectCamera}
          />
        )}

        {city.isCustomGroup && visibleCameras.length === 0 ? (
          <div className="empty">
            <p className="empty__title">No cameras added yet</p>
            <p className="empty__body">
              Add a public camera by its IP or URL — a snapshot JPEG, an MJPEG stream, or an HLS
              feed. They live only in this browser.
            </p>
            <button type="button" className="btn btn--primary" onClick={() => setDialog({})}>
              + Add your first camera
            </button>
          </div>
        ) : (
          <CameraGrid
            cameras={visibleCameras}
            wallLimit={wallLimit}
            onExpand={handleSelectCamera}
            isFavorite={isFavorite}
            onToggleFavorite={toggleFavorite}
          />
        )}
      </main>

      {theaterCamera && (
        <Theater
          camera={theaterCamera}
          city={city}
          onClose={() => setTheaterId(null)}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          onEdit={
            theaterCamera.custom
              ? () => {
                  const input = customInputs.find((c) => c.id === theaterCamera.id)
                  if (input) setDialog({ editing: input })
                }
              : undefined
          }
          onRemove={theaterCamera.custom ? () => handleRemoveCamera(theaterCamera.id) : undefined}
        />
      )}

      {dialog && (
        <AddCameraDialog
          editing={dialog.editing}
          onClose={() => setDialog(null)}
          onSave={handleSaveCamera}
        />
      )}
    </div>
  )
}
