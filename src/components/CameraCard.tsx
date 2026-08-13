import { useState } from 'react'
import type { Camera, CameraStatus } from '../types'
import { CameraPlayer } from './CameraPlayer'
import { youtubeThumbnail } from './YouTubeEmbed'
import { isEmbeddable } from '../data/cameras'

interface Props {
  camera: Camera
  active: boolean
  favorite: boolean
  onActivate: () => void
  onExpand: () => void
  onToggleFavorite: () => void
}

function posterFor(camera: Camera): string | undefined {
  if (camera.source.kind === 'youtube' && camera.source.videoId) {
    return youtubeThumbnail(camera.source.videoId)
  }
  return undefined
}

export function CameraCard({
  camera,
  active,
  favorite,
  onActivate,
  onExpand,
  onToggleFavorite,
}: Props) {
  const [status, setStatus] = useState<CameraStatus>('idle')
  const poster = posterFor(camera)
  const embeddable = isEmbeddable(camera)

  const showLiveBadge = active && embeddable && status !== 'error' && camera.source.kind !== 'windy'

  return (
    <article className={`card${favorite ? ' card--fav' : ''}`}>
      <div className="card__stage">
        {active ? (
          <CameraPlayer camera={camera} onStatus={setStatus} />
        ) : (
          <button
            type="button"
            className="card__poster"
            onClick={onActivate}
            aria-label={`Start ${camera.name} feed`}
          >
            {poster ? (
              <img className="feed-media" src={poster} alt="" loading="lazy" />
            ) : (
              <div className="card__poster-fallback" aria-hidden />
            )}
            <span className="card__play">
              <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
            </span>
          </button>
        )}

        <div className="card__overlay">
          {showLiveBadge && (
            <span className="badge badge--live">
              <span className="badge__dot" />
              LIVE
            </span>
          )}
          {camera.source.kind === 'windy' && active && (
            <span className="badge badge--stills">STILLS</span>
          )}
          {!embeddable && <span className="badge badge--external">EXTERNAL</span>}
          {status === 'error' && <span className="badge badge--error">OFFLINE</span>}
        </div>

        <div className="card__controls">
          {active && embeddable && (
            <button
              type="button"
              className="card__ctrl card__expand"
              onClick={onExpand}
              aria-label={`Expand ${camera.name}`}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                <path
                  d="M4 9V4h5M20 15v5h-5M15 4h5v5M9 20H4v-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
          <button
            type="button"
            className={`card__ctrl card__fav${favorite ? ' card__fav--on' : ''}`}
            onClick={onToggleFavorite}
            aria-pressed={favorite}
            aria-label={favorite ? `Remove ${camera.name} from favorites` : `Add ${camera.name} to favorites`}
            title={favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
              <path
                d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18.9l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z"
                fill={favorite ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="card__meta">
        <div className="card__title-row">
          <h3 className="card__title">{camera.name}</h3>
          {camera.nearby && <span className="chip chip--muted">nearby</span>}
        </div>
        {camera.description && <p className="card__desc">{camera.description}</p>}
        <div className="card__footer">
          <span className="card__operator">{camera.operator}</span>
          {camera.pageUrl && (
            <a
              className="card__source"
              href={camera.pageUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              source ↗
            </a>
          )}
        </div>
      </div>
    </article>
  )
}
