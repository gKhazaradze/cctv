import { useEffect, useState } from 'react'
import { bestWindyImage, fetchWindyWebcam, hasWindyKey } from '../lib/windy'
import type { CameraStatus } from '../types'

interface Props {
  webcamId: string
  pageUrl?: string
  onStatus?: (status: CameraStatus) => void
}

/** Windy free-tier image tokens last ~10 minutes; refresh well inside that. */
const REFRESH_MS = 4 * 60 * 1000

/**
 * Shows the latest still frame for a Windy-hosted webcam.
 *
 * Windy's free tier serves periodically-updated images rather than video, so
 * this is a slideshow of the most recent frame, not a live stream — the UI says
 * so plainly rather than dressing it up as one.
 */
export function WindyStill({ webcamId, pageUrl, onStatus }: Props) {
  const [imageUrl, setImageUrl] = useState<string>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!hasWindyKey()) {
      onStatus?.('unsupported')
      return
    }

    const controller = new AbortController()
    let timer: number | undefined
    let cancelled = false

    const load = async () => {
      onStatus?.('connecting')
      try {
        const webcam = await fetchWindyWebcam(webcamId, controller.signal)
        if (cancelled) return

        const url = bestWindyImage(webcam)
        if (!url) throw new Error('Windy returned no image for this webcam')

        setImageUrl(url)
        setError(undefined)
        onStatus?.('playing')
      } catch (err) {
        if (cancelled || controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Could not reach Windy')
        onStatus?.('error')
      } finally {
        if (!cancelled) timer = window.setTimeout(load, REFRESH_MS)
      }
    }

    void load()

    return () => {
      cancelled = true
      controller.abort()
      if (timer) window.clearTimeout(timer)
    }
    // onStatus is a stable callback from the parent; refetch only on id change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webcamId])

  if (!hasWindyKey()) {
    return (
      <div className="feed-placeholder">
        <p className="feed-placeholder__title">Needs a Windy API key</p>
        <p className="feed-placeholder__body">
          Add <code>VITE_WINDY_API_KEY</code> to <code>.env.local</code> to show frames from this
          camera.
        </p>
        {pageUrl && (
          <a className="btn btn--ghost" href={pageUrl} target="_blank" rel="noreferrer noopener">
            Watch on Windy ↗
          </a>
        )}
      </div>
    )
  }

  if (error) {
    return (
      <div className="feed-placeholder">
        <p className="feed-placeholder__title">Windy request failed</p>
        <p className="feed-placeholder__body">{error}</p>
      </div>
    )
  }

  if (!imageUrl) {
    return <div className="feed-placeholder feed-placeholder--loading">Fetching latest frame…</div>
  }

  return <img className="feed-media" src={imageUrl} alt="Latest frame from Windy webcam" />
}
