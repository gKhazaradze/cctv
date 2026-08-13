import { useEffect, useState } from 'react'
import type { Camera, CameraStatus } from '../types'
import { HlsVideo } from './HlsVideo'
import { YouTubeEmbed } from './YouTubeEmbed'
import { WindyStill } from './WindyStill'

interface Props {
  camera: Camera
  /** Theater view wants player chrome; grid tiles do not. */
  controls?: boolean
  onStatus?: (status: CameraStatus) => void
}

/** A still image the operator overwrites on a fixed cadence. */
function RefreshingImage({
  url,
  refreshSeconds = 30,
  alt,
  onStatus,
}: {
  url: string
  refreshSeconds?: number
  alt: string
  onStatus?: (status: CameraStatus) => void
}) {
  const [cacheBust, setCacheBust] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setCacheBust((n) => n + 1), refreshSeconds * 1000)
    return () => window.clearInterval(id)
  }, [refreshSeconds])

  const separator = url.includes('?') ? '&' : '?'

  return (
    <img
      className="feed-media"
      src={`${url}${separator}_=${cacheBust}`}
      alt={alt}
      onLoad={() => onStatus?.('playing')}
      onError={() => onStatus?.('error')}
    />
  )
}

/** Resolves a stream URL against the optional dev proxy. */
function resolveUrl(url: string, viaProxy?: boolean): string {
  if (!viaProxy) return url
  try {
    const parsed = new URL(url)
    return `/stream-proxy${parsed.pathname}${parsed.search}`
  } catch {
    return url
  }
}

/**
 * Renders whichever player a camera's source kind calls for.
 *
 * Only mounted once a tile is actually meant to be playing — keeping a dozen
 * YouTube iframes alive off-screen is what turns a camera wall into a fan-spinning
 * mess, so the grid controls mounting rather than hiding players with CSS.
 */
export function CameraPlayer({ camera, controls = false, onStatus }: Props) {
  const { source } = camera

  switch (source.kind) {
    case 'youtube':
      return (
        <YouTubeEmbed
          videoId={source.videoId}
          channelId={source.channelId}
          title={`${camera.name} — live camera`}
          controls={controls}
        />
      )

    case 'hls':
      return source.url ? (
        <HlsVideo
          src={resolveUrl(source.url, source.viaProxy)}
          controls={controls}
          onStatus={onStatus}
        />
      ) : null

    case 'mjpeg':
      return source.url ? (
        <img
          className="feed-media"
          src={resolveUrl(source.url, source.viaProxy)}
          alt={`${camera.name} — live camera`}
          onLoad={() => onStatus?.('playing')}
          onError={() => onStatus?.('error')}
        />
      ) : null

    case 'image':
      return source.url ? (
        <RefreshingImage
          url={resolveUrl(source.url, source.viaProxy)}
          refreshSeconds={source.refreshSeconds}
          alt={`${camera.name} — latest frame`}
          onStatus={onStatus}
        />
      ) : null

    case 'iframe':
      return source.url ? (
        <iframe
          className="feed-media"
          src={source.url}
          title={`${camera.name} — live camera`}
          loading="lazy"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : null

    case 'windy':
      return source.webcamId ? (
        <WindyStill
          webcamId={source.webcamId}
          pageUrl={camera.pageUrl}
          onStatus={onStatus}
        />
      ) : null

    case 'link':
      return (
        <div className="feed-placeholder">
          <p className="feed-placeholder__title">Watch at the source</p>
          <p className="feed-placeholder__body">
            {camera.operator} publishes this camera on their own site but does not permit it to be
            embedded elsewhere.
          </p>
          {camera.pageUrl && (
            <a className="btn btn--ghost" href={camera.pageUrl} target="_blank" rel="noreferrer noopener">
              Open {camera.operator} ↗
            </a>
          )}
        </div>
      )
  }
}
