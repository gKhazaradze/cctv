/**
 * How a given camera can actually be shown in a browser.
 *
 * The distinction that matters most is `link` vs everything else: plenty of
 * well-known city cameras are public to *watch* but are not licensed or
 * technically permitted to be re-embedded. Those are modelled explicitly rather
 * than quietly dropped, so the registry can stay an honest map of what exists.
 */
export type SourceKind =
  /** YouTube live stream the operator has left publicly embeddable. */
  | 'youtube'
  /** Direct HLS (.m3u8) manifest served with permissive CORS. */
  | 'hls'
  /** `multipart/x-mixed-replace` stream, rendered straight into an <img>. */
  | 'mjpeg'
  /** A single still image the operator refreshes on a fixed cadence. */
  | 'image'
  /** An operator-provided embed page meant to be iframed. */
  | 'iframe'
  /** A webcam in Windy's public database; needs a free API key to show frames. */
  | 'windy'
  /** Watchable only on the operator's own site — we link out instead. */
  | 'link'

export interface CameraSource {
  kind: SourceKind
  /** `youtube`: the 11-character video id of a persistent live stream. */
  videoId?: string
  /**
   * `youtube`: a channel id, used with YouTube's `live_stream` embed so the
   * card follows whatever that channel currently has live. More durable than a
   * video id, but only correct for channels that run a single stream.
   */
  channelId?: string
  /** `hls` | `mjpeg` | `image` | `iframe`: the resource to load. */
  url?: string
  /** `image`: how often to re-fetch, in seconds. */
  refreshSeconds?: number
  /** `windy`: the numeric webcam id from windy.com. */
  webcamId?: string
  /** Route this stream through the dev proxy (see vite.config.ts). */
  viaProxy?: boolean
}

export interface Camera {
  id: string
  cityId: string
  name: string
  /** What you are actually looking at, and which way the camera points. */
  description?: string
  /** Who runs the camera. Always credit them. */
  operator: string
  /** The operator's own page for this camera — the "watch at source" link. */
  pageUrl?: string
  /** [lat, lon] of the camera itself, for the map. */
  coords?: [number, number]
  tags?: string[]
  source: CameraSource
  /**
   * True when the camera is in the metro area but outside the city proper —
   * kept separate so a city's headline count stays truthful.
   */
  nearby?: boolean
  /** ISO date this entry was last confirmed working by `npm run check:cams`. */
  verifiedAt?: string
  /**
   * True for a camera the user added themselves (by IP/URL), stored locally in
   * the browser rather than in the checked-in registry. These get edit/remove
   * controls the built-ins don't.
   */
  custom?: boolean
}

/**
 * What sort of group a `City` entry is. Every browsable group — a real city, a
 * thematic collection, or the user's own saved cameras — is modelled as a
 * `City` so the grid/map/theater treat them all the same.
 */
export type GroupKind = 'all' | 'city' | 'collection' | 'custom'

export interface City {
  id: string
  name: string
  /** The city's name in its own language/script. */
  localName?: string
  country: string
  /** ISO 3166-1 alpha-2, used to derive the flag emoji. Blank for collections. */
  countryCode: string
  /**
   * IANA zone, so we can show the group's own wall-clock time. Optional: a
   * thematic collection spans many zones, so it has none.
   */
  timeZone?: string
  /**
   * [lat, lon] of the city centre. Optional: collections and the "My cameras"
   * group have no single location, so they omit this and the map/light skip it.
   */
  coords?: [number, number]
  blurb?: string
  /** 'city' (default) | 'collection' | 'custom'. Drives sidebar grouping. */
  kind?: GroupKind
  /** Emoji shown instead of a flag for a collection. */
  icon?: string
  /** True for the synthetic group holding the user's own added cameras. */
  isCustomGroup?: boolean
}

/** Runtime playability state for a single camera tile. */
export type CameraStatus = 'idle' | 'connecting' | 'playing' | 'error' | 'unsupported'
