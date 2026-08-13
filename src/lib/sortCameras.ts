import type { Camera } from '../types'
import { sunAltitudeDeg } from './sun'

/**
 * Ways to order the camera grid. Kept pure and separate from React so the
 * ordering is easy to test and reason about.
 */
export type SortKey = 'grouped' | 'name-asc' | 'name-desc' | 'place' | 'daytime' | 'shuffle'

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'grouped', label: 'Grouped' },
  { key: 'name-asc', label: 'Name A–Z' },
  { key: 'name-desc', label: 'Name Z–A' },
  { key: 'place', label: 'Place' },
  { key: 'daytime', label: 'Daytime first' },
  { key: 'shuffle', label: 'Shuffle' },
]

export interface SortContext {
  /** Display name of the group a camera belongs to (its city/collection). */
  groupName: (cityId: string) => string
  /** Reference time for the daylight ordering. */
  now: Date
  /** Reseeded each time the user picks Shuffle, so the order changes. */
  shuffleSeed: number
}

const byName = (a: Camera, b: Camera) => a.name.localeCompare(b.name)

/** A camera with no coordinates sorts to the very end of a daylight ordering. */
const NIGHTLESS = -999

/** Cheap deterministic 0..1 hash, so a given seed yields a stable shuffle. */
function hash01(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

/**
 * Returns a new array — never mutates the input. Array.prototype.sort is stable
 * in modern engines, so ties keep their incoming (curated) order.
 */
export function sortCameras(cameras: Camera[], key: SortKey, ctx: SortContext): Camera[] {
  const arr = cameras.slice()

  switch (key) {
    case 'grouped':
      // Preserve the order handed in — the curated cities-then-collections order.
      return arr

    case 'name-asc':
      return arr.sort(byName)

    case 'name-desc':
      return arr.sort((a, b) => byName(b, a))

    case 'place':
      return arr.sort(
        (a, b) => ctx.groupName(a.cityId).localeCompare(ctx.groupName(b.cityId)) || byName(a, b),
      )

    case 'daytime': {
      const altitude = (c: Camera) =>
        c.coords ? sunAltitudeDeg(ctx.now, c.coords[0], c.coords[1]) : NIGHTLESS
      // Highest sun first; cameras with no location fall to the bottom.
      return arr.sort((a, b) => altitude(b) - altitude(a) || byName(a, b))
    }

    case 'shuffle':
      return arr.sort(
        (a, b) => hash01(`${a.id}:${ctx.shuffleSeed}`) - hash01(`${b.id}:${ctx.shuffleSeed}`),
      )

    default:
      return arr
  }
}

/**
 * Floats favourited cameras to the front, preserving the given order within the
 * favourites and within the rest — so favourites lead in whatever sort is active.
 * Returns a new array; never mutates the input.
 */
export function floatFavorites(
  cameras: Camera[],
  isFavorite: (id: string) => boolean,
): Camera[] {
  const favorites: Camera[] = []
  const rest: Camera[] = []
  for (const camera of cameras) {
    ;(isFavorite(camera.id) ? favorites : rest).push(camera)
  }
  return favorites.length === 0 ? cameras : [...favorites, ...rest]
}
