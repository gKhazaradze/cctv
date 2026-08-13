import { useCallback, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'citywatch:favorites:v1'

function load(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * Favourited camera IDs, persisted in localStorage and synced across tabs —
 * the same lightweight pattern as the user's added cameras.
 */
export function useFavorites() {
  const [ids, setIds] = useState<string[]>(load)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
    } catch {
      // A full or blocked store just means favourites won't persist this session.
    }
  }, [ids])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setIds(load())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const favorites = useMemo(() => new Set(ids), [ids])
  const isFavorite = useCallback((id: string) => favorites.has(id), [favorites])
  const toggle = useCallback(
    (id: string) => setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    [],
  )

  return { favorites, isFavorite, toggle, count: ids.length }
}
