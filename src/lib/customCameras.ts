import type { Camera, City, SourceKind } from '../types'

/**
 * Support for cameras the user adds themselves by IP or URL.
 *
 * Lots of public webcams are reachable directly over HTTP — a snapshot JPEG that
 * updates every few seconds, or an MJPEG stream — and those play in a browser
 * with no server in between. This module turns a pasted address into a playable
 * tile, stores the user's cameras in their browser, and keeps the pure,
 * testable inference logic separate from React.
 *
 * Scope, on purpose: this helps you add cameras a site or operator has published.
 * It is not a scanner and does not hunt the internet for cameras left exposed by
 * accident — those are usually private cameras whose owners never consented, and
 * pointing a tool at them is a different thing entirely.
 */

export const CUSTOM_CITY_ID = 'custom'

const STORAGE_KEY = 'citywatch:customCameras:v1'

/** The playback kinds a user-added camera is allowed to use. */
export type CustomKind = Extract<SourceKind, 'image' | 'mjpeg' | 'hls' | 'iframe'>

export interface CustomCameraInput {
  id: string
  name: string
  url: string
  kind: CustomKind
  /** For `image` snapshots: seconds between refreshes. */
  refreshSeconds?: number
  operator?: string
  /** Optional [lat, lon] so the camera shows on the map. */
  coords?: [number, number]
  addedAt: string
}

/** A ready-to-fill path template for a known camera brand, `{host}` substituted. */
export interface CameraPreset {
  id: string
  label: string
  kind: CustomKind
  /** Path appended to `http://<host>`, or a hint when the user must fill it in. */
  path: string
  refreshSeconds?: number
  note?: string
}

/**
 * Common default endpoints by brand. These are the manufacturer defaults for
 * cameras whose owner has enabled anonymous access — they save typing, they are
 * not a way in to a camera that is locked.
 */
export const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: 'generic-mjpeg',
    label: 'Generic MJPEG stream',
    kind: 'mjpeg',
    path: '/mjpg/video.mjpg',
    note: 'Motion-JPEG stream — plays as continuous video.',
  },
  {
    id: 'generic-snapshot',
    label: 'Generic snapshot (JPEG)',
    kind: 'image',
    path: '/snapshot.jpg',
    refreshSeconds: 5,
    note: 'A still image the camera overwrites; refreshed on a timer.',
  },
  {
    id: 'axis-mjpeg',
    label: 'Axis — MJPEG',
    kind: 'mjpeg',
    path: '/axis-cgi/mjpg/video.cgi',
  },
  {
    id: 'axis-snapshot',
    label: 'Axis — snapshot',
    kind: 'image',
    path: '/axis-cgi/jpg/image.cgi',
    refreshSeconds: 4,
  },
  {
    id: 'mobotix',
    label: 'Mobotix — MJPEG',
    kind: 'mjpeg',
    path: '/cgi-bin/faststream.jpg?stream=MxPEG',
  },
  {
    id: 'dahua-snapshot',
    label: 'Dahua — snapshot',
    kind: 'image',
    path: '/cgi-bin/snapshot.cgi',
    refreshSeconds: 4,
  },
  {
    id: 'hikvision-snapshot',
    label: 'Hikvision — snapshot',
    kind: 'image',
    path: '/ISAPI/Streaming/channels/101/picture',
    refreshSeconds: 4,
  },
  {
    id: 'foscam-snapshot',
    label: 'Foscam — snapshot',
    kind: 'image',
    path: '/cgi-bin/CGIProxy.fcgi?cmd=snapPicture2',
    refreshSeconds: 4,
  },
  {
    id: 'hls',
    label: 'HLS stream (.m3u8)',
    kind: 'hls',
    path: '/live/stream.m3u8',
    note: 'Needs the camera/CDN to send CORS headers, or it will not play.',
  },
  {
    id: 'iframe',
    label: 'Embed page (iframe)',
    kind: 'iframe',
    path: '/',
    note: "Only works if the operator's page allows being embedded.",
  },
]

export interface InferResult {
  kind: CustomKind | 'rtsp' | 'unknown'
  /** Normalised absolute URL, when one could be formed. */
  url?: string
  refreshSeconds?: number
  /** Set when the address cannot be used as-is (e.g. RTSP in a browser). */
  problem?: string
  /** Human-readable reason for the guess. */
  reason?: string
}

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)(\?|$)/i
const HLS_EXT = /\.m3u8(\?|$)/i
const MJPEG_HINT = /(mjpe?g|video\.cgi|faststream|\.cgi\?.*stream|axis-cgi\/mjpg)/i
const SNAPSHOT_HINT = /(snapshot|snappicture|jpg\/image|\/picture|\/image\.|getimage)/i

/**
 * Turns whatever the user typed into a best-guess source.
 *
 * Pure and synchronous — the network reachability check is a separate concern
 * (see `probeReachable`), because a browser cannot read a cross-origin response
 * to sniff its content-type anyway. This only reasons about the URL string.
 */
export function inferSource(raw: string): InferResult {
  const input = raw.trim()
  if (!input) return { kind: 'unknown', problem: 'Enter a camera address.' }

  if (/^rtsp:\/\//i.test(input)) {
    return {
      kind: 'rtsp',
      url: input,
      problem:
        'RTSP streams cannot play directly in a browser. Run the optional go2rtc helper (see docs/ip-cameras.md) to convert it, then add the HLS URL it gives you.',
    }
  }

  // Accept a bare host or IP and assume http:// — that is how these cameras are
  // usually shared ("just go to 203.0.113.7").
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `http://${input}`)
  } catch {
    return { kind: 'unknown', problem: 'That does not look like a valid address or URL.' }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { kind: 'unknown', url: url.href, problem: `Unsupported protocol ${url.protocol}` }
  }

  const href = url.href
  const pathAndQuery = url.pathname + url.search

  if (HLS_EXT.test(pathAndQuery)) {
    return { kind: 'hls', url: href, reason: 'ends in .m3u8' }
  }
  if (MJPEG_HINT.test(pathAndQuery)) {
    return { kind: 'mjpeg', url: href, reason: 'path looks like an MJPEG stream' }
  }
  if (SNAPSHOT_HINT.test(pathAndQuery) || IMAGE_EXT.test(pathAndQuery)) {
    return { kind: 'image', url: href, refreshSeconds: 5, reason: 'path looks like a snapshot image' }
  }

  // A bare host with no path is ambiguous: treat as a snapshot attempt, which
  // the reachability probe can confirm by actually loading it as an image.
  return {
    kind: 'unknown',
    url: href,
    reason: 'could not tell from the address — pick a type or use Test',
  }
}

/**
 * Checks whether a URL loads as an image in this browser.
 *
 * This is the only reachability signal a browser can get cross-origin: an
 * <img> can DISPLAY another origin's image without CORS (it just cannot read the
 * pixels), and MJPEG streams fire `load` on their first frame too. HLS and
 * iframe cameras cannot be probed this way, so callers should skip them.
 */
export function probeReachable(url: string, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false)
      return
    }
    const img = new Image()
    let done = false

    const finish = (ok: boolean) => {
      if (done) return
      done = true
      img.onload = null
      img.onerror = null
      img.src = ''
      window.clearTimeout(timer)
      resolve(ok)
    }

    const timer = window.setTimeout(() => finish(false), timeoutMs)
    img.onload = () => finish(true)
    img.onerror = () => finish(false)
    // Cache-bust so a probe never reads a stale cached frame.
    const sep = url.includes('?') ? '&' : '?'
    img.src = `${url}${sep}_probe=${Date.now()}`
  })
}

/** Maps a stored custom camera onto the app's normal Camera shape. */
export function toCamera(input: CustomCameraInput): Camera {
  return {
    id: input.id,
    cityId: CUSTOM_CITY_ID,
    name: input.name,
    operator: input.operator?.trim() || 'Added by you',
    coords: input.coords,
    custom: true,
    tags: ['custom'],
    source:
      input.kind === 'image'
        ? { kind: 'image', url: input.url, refreshSeconds: input.refreshSeconds ?? 5 }
        : { kind: input.kind, url: input.url },
  }
}

/** The synthetic city that holds the user's own cameras. Null when there are none. */
export function customCity(count: number): City | null {
  if (count <= 0) return null
  return {
    id: CUSTOM_CITY_ID,
    name: 'My cameras',
    country: 'Added by you',
    countryCode: 'ZZ',
    timeZone: viewerTimeZone(),
    isCustomGroup: true,
    blurb: 'Cameras you added by IP or URL. Stored only in this browser.',
  }
}

function viewerTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

// -------------------------------------------------------------- storage ----

function isValid(entry: unknown): entry is CustomCameraInput {
  if (!entry || typeof entry !== 'object') return false
  const e = entry as Record<string, unknown>
  return (
    typeof e.id === 'string' &&
    typeof e.name === 'string' &&
    typeof e.url === 'string' &&
    (e.kind === 'image' || e.kind === 'mjpeg' || e.kind === 'hls' || e.kind === 'iframe')
  )
}

export function loadCustomCameras(): CustomCameraInput[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isValid) : []
  } catch {
    return []
  }
}

export function saveCustomCameras(list: CustomCameraInput[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // Storage full or blocked: the cameras stay for this session regardless.
  }
}

/** A stable-ish id without needing a crypto dependency. */
export function makeCameraId(): string {
  const rand = Math.random().toString(36).slice(2, 8)
  return `custom-${Date.now().toString(36)}-${rand}`
}
