import { useEffect } from 'react'
import type { Camera, City } from '../types'
import { CameraPlayer } from './CameraPlayer'
import { isEmbeddable } from '../data/cameras'

interface Props {
  camera: Camera
  city?: City
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  /** Present only for user-added cameras. */
  onEdit?: () => void
  onRemove?: () => void
}

export function Theater({ camera, city, onClose, onPrev, onNext, onEdit, onRemove }: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') onPrev()
      if (event.key === 'ArrowRight') onNext()
    }
    window.addEventListener('keydown', onKey)

    // Stop the page behind the overlay from scrolling under it.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose, onPrev, onNext])

  return (
    <div className="theater" role="dialog" aria-modal="true" aria-label={`${camera.name} live camera`}>
      <div className="theater__backdrop" onClick={onClose} />

      <div className="theater__body">
        <header className="theater__header">
          <div>
            <h2 className="theater__title">{camera.name}</h2>
            <p className="theater__sub">
              {city ? `${city.name}, ${city.country}` : ''} · {camera.operator}
            </p>
          </div>
          <button type="button" className="theater__close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className="theater__stage">
          <CameraPlayer camera={camera} controls />
        </div>

        <footer className="theater__footer">
          <button type="button" className="btn btn--ghost" onClick={onPrev}>
            ← Previous
          </button>

          <div className="theater__info">
            {camera.description && <p className="theater__desc">{camera.description}</p>}
            {camera.custom ? (
              <div className="theater__custom-actions">
                <span className="theater__desc">{camera.operator}</span>
                {onEdit && (
                  <button type="button" className="theater__link theater__link--btn" onClick={onEdit}>
                    Edit
                  </button>
                )}
                {onRemove && (
                  <button
                    type="button"
                    className="theater__link theater__link--btn theater__link--danger"
                    onClick={onRemove}
                  >
                    Remove
                  </button>
                )}
              </div>
            ) : (
              camera.pageUrl && (
                <a
                  className="theater__link"
                  href={camera.pageUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {isEmbeddable(camera) ? 'View at source' : `Watch on ${camera.operator}`} ↗
                </a>
              )
            )}
          </div>

          <button type="button" className="btn btn--ghost" onClick={onNext}>
            Next →
          </button>
        </footer>
      </div>
    </div>
  )
}
