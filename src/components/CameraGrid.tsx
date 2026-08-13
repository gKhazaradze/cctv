import { useEffect, useMemo, useState } from 'react'
import type { Camera } from '../types'
import { CameraCard } from './CameraCard'
import { isEmbeddable } from '../data/cameras'

interface Props {
  cameras: Camera[]
  /** How many feeds may auto-start. 0 keeps everything as posters. */
  wallLimit: number
  onExpand: (camera: Camera) => void
  isFavorite: (id: string) => boolean
  onToggleFavorite: (id: string) => void
}

export function CameraGrid({
  cameras,
  wallLimit,
  onExpand,
  isFavorite,
  onToggleFavorite,
}: Props) {
  const [manuallyActive, setManuallyActive] = useState<ReadonlySet<string>>(new Set())

  // A new city (or a new wall setting) should start from a clean slate rather
  // than carrying over feeds the viewer opened somewhere else.
  const cityKey = cameras.map((c) => c.id).join('|')
  useEffect(() => {
    setManuallyActive(new Set())
  }, [cityKey, wallLimit])

  const autoActive = useMemo(() => {
    if (wallLimit <= 0) return new Set<string>()
    return new Set(
      cameras
        .filter(isEmbeddable)
        .slice(0, wallLimit)
        .map((c) => c.id),
    )
  }, [cameras, wallLimit])

  if (cameras.length === 0) {
    return (
      <div className="empty">
        <p className="empty__title">No cameras match</p>
        <p className="empty__body">Try clearing the filter.</p>
      </div>
    )
  }

  return (
    <div className="grid">
      {cameras.map((camera) => (
        <CameraCard
          key={camera.id}
          camera={camera}
          active={autoActive.has(camera.id) || manuallyActive.has(camera.id)}
          favorite={isFavorite(camera.id)}
          onActivate={() =>
            setManuallyActive((prev) => new Set(prev).add(camera.id))
          }
          onExpand={() => onExpand(camera)}
          onToggleFavorite={() => onToggleFavorite(camera.id)}
        />
      ))}
    </div>
  )
}
