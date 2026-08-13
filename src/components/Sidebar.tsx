import { useMemo, useState } from 'react'
import type { Camera, City, GroupKind } from '../types'
import { flagEmoji } from '../data/cities'
import { formatLocalTime } from '../lib/time'
import { daylightPhase, phaseIcon, phaseLabel } from '../lib/sun'
import { isEmbeddable } from '../data/cameras'

interface Props {
  cities: City[]
  cameras: Camera[]
  selectedCityId: string
  now: Date
  onSelectCity: (cityId: string) => void
}

const SECTIONS: { kind: GroupKind; title: string }[] = [
  { kind: 'city', title: 'Cities' },
  { kind: 'collection', title: 'Collections' },
  { kind: 'custom', title: 'My cameras' },
]

export function Sidebar({ cities, cameras, selectedCityId, now, onSelectCity }: Props) {
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return cities
    return cities.filter((city) =>
      [city.name, city.localName, city.country, city.blurb].some((field) =>
        field?.toLowerCase().includes(q),
      ),
    )
  }, [cities, query])

  const countsByCity = useMemo(() => {
    const counts = new Map<string, { total: number; live: number }>()
    for (const camera of cameras) {
      const entry = counts.get(camera.cityId) ?? { total: 0, live: 0 }
      entry.total += 1
      if (isEmbeddable(camera)) entry.live += 1
      counts.set(camera.cityId, entry)
    }
    return counts
  }, [cameras])

  // Totals for the "All" group, which spans every camera.
  const totals = useMemo(
    () => ({ total: cameras.length, live: cameras.filter(isEmbeddable).length }),
    [cameras],
  )

  const allGroup = cities.find((c) => c.kind === 'all')

  const renderRow = (city: City) => {
    const counts =
      city.kind === 'all' ? totals : countsByCity.get(city.id) ?? { total: 0, live: 0 }
    const phase = city.coords ? daylightPhase(now, city.coords[0], city.coords[1]) : null
    const selected = city.id === selectedCityId

    return (
      <button
        key={city.id}
        type="button"
        className={`city-item${city.kind === 'all' ? ' city-item--all' : ''}${
          selected ? ' city-item--active' : ''
        }`}
        onClick={() => onSelectCity(city.id)}
        aria-current={selected ? 'true' : undefined}
      >
        <span className="city-item__flag" aria-hidden>
          {city.icon ?? (city.isCustomGroup ? '📷' : flagEmoji(city.countryCode))}
        </span>

        <span className="city-item__main">
          <span className="city-item__name">{city.name}</span>
          <span className="city-item__country">{city.country}</span>
        </span>

        <span className="city-item__side">
          {city.timeZone ? (
            <span className="city-item__time">{formatLocalTime(now, city.timeZone)}</span>
          ) : (
            <span className="city-item__time city-item__time--muted">{counts.total} cams</span>
          )}
          <span
            className={`city-item__phase${phase ? ` city-item__phase--${phase}` : ''}`}
            title={phase ? phaseLabel[phase] : undefined}
          >
            {phase ? `${phaseIcon[phase]} ` : ''}
            {counts.live}/{counts.total}
          </span>
        </span>
      </button>
    )
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__mark" aria-hidden>
          ◉
        </span>
        <div>
          <h1 className="sidebar__title">CityWatch</h1>
          <p className="sidebar__tagline">Public cameras, live from around the world</p>
        </div>
      </div>

      <label className="search">
        <span className="sr-only">Search</span>
        <input
          type="search"
          className="search__input"
          placeholder="Search places or collections…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <nav className="city-list" aria-label="Places and collections">
        {/* Pinned at the top and never filtered out — it's a persistent control. */}
        {allGroup && <div className="city-section">{renderRow(allGroup)}</div>}

        {SECTIONS.map(({ kind, title }) => {
          const groups = visible.filter((c) => (c.kind ?? 'city') === kind)
          if (groups.length === 0) return null
          return (
            <div key={kind} className="city-section">
              <p className="city-section__title">{title}</p>
              {groups.map(renderRow)}
            </div>
          )
        })}

        {visible.filter((c) => c.kind !== 'all').length === 0 && (
          <p className="city-list__empty">Nothing matches “{query}”.</p>
        )}
      </nav>

      <footer className="sidebar__footer">
        <p>
          Feeds are published by their operators, who are credited on every tile. Cameras that
          cannot be embedded link out to the source instead.
        </p>
      </footer>
    </aside>
  )
}
