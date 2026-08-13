import { useEffect, useRef } from 'react'
import type HlsPlayer from 'hls.js'
import type { CameraStatus } from '../types'

interface Props {
  src: string
  poster?: string
  muted?: boolean
  controls?: boolean
  onStatus?: (status: CameraStatus) => void
}

/**
 * Plays an HLS manifest, using the browser's native support where it exists
 * (Safari, iOS) and hls.js everywhere else.
 *
 * hls.js is ~500 kB and is only needed for `hls` cameras on non-Safari
 * browsers, so it is pulled in dynamically rather than shipped to every visitor
 * who just wants to watch a YouTube tile.
 *
 * Live feeds drop out constantly — a van parks in front of the uplink, a segment
 * 404s — so fatal errors get one recovery attempt at the right layer before the
 * tile is declared dead.
 */
export function HlsVideo({ src, poster, muted = true, controls = false, onStatus }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  // Held in a ref so the effect below never re-runs just because status changed.
  const statusRef = useRef(onStatus)
  statusRef.current = onStatus

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const report = (s: CameraStatus) => statusRef.current?.(s)
    report('connecting')

    const onPlaying = () => report('playing')
    const onNativeError = () => report('error')
    video.addEventListener('playing', onPlaying)

    let hls: HlsPlayer | undefined
    let disposed = false
    let recovered = false

    if (video.canPlayType('application/vnd.apple.mpegurl') !== '') {
      video.src = src
      video.addEventListener('error', onNativeError)
    } else {
      void (async () => {
        const { default: Hls } = await import('hls.js')
        if (disposed || !videoRef.current) return

        if (!Hls.isSupported()) {
          report('unsupported')
          return
        }

        hls = new Hls({
          liveDurationInfinity: true,
          // Keep the buffer short so we sit near the live edge rather than
          // drifting minutes behind after a stall.
          maxBufferLength: 12,
        })

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && !recovered) {
            recovered = true
            hls?.startLoad()
            return
          }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recovered) {
            recovered = true
            hls?.recoverMediaError()
            return
          }
          report('error')
        })

        hls.loadSource(src)
        hls.attachMedia(video)
      })()
    }

    return () => {
      disposed = true
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('error', onNativeError)
      hls?.destroy()
      video.removeAttribute('src')
      video.load()
    }
  }, [src])

  return (
    <video
      ref={videoRef}
      className="feed-media"
      poster={poster}
      muted={muted}
      controls={controls}
      autoPlay
      playsInline
    />
  )
}
