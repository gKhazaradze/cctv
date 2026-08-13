import { useEffect, useMemo, useState } from 'react'
import {
  CAMERA_PRESETS,
  inferSource,
  makeCameraId,
  probeReachable,
  type CustomCameraInput,
  type CustomKind,
} from '../lib/customCameras'

interface Props {
  /** When set, the dialog opens pre-filled to edit this camera. */
  editing?: CustomCameraInput
  onClose: () => void
  onSave: (camera: CustomCameraInput) => void
}

type ProbeState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok'; message: string }
  | { status: 'fail'; message: string }

const KIND_LABELS: Record<CustomKind, string> = {
  image: 'Snapshot (JPEG, refreshed)',
  mjpeg: 'MJPEG stream',
  hls: 'HLS stream (.m3u8)',
  iframe: 'Embed page (iframe)',
}

/**
 * Add or edit a camera by IP/URL.
 *
 * The flow is built around the reality that a browser cannot inspect a
 * cross-origin response: we infer the type from the address, let the user
 * override it, and offer a live "Test" that actually tries to load the image —
 * the one reachability signal that works cross-origin.
 */
export function AddCameraDialog({ editing, onClose, onSave }: Props) {
  const [address, setAddress] = useState(editing?.url ?? '')
  const [name, setName] = useState(editing?.name ?? '')
  const [operator, setOperator] = useState(editing?.operator ?? '')
  const [kind, setKind] = useState<CustomKind>(editing?.kind ?? 'image')
  const [refreshSeconds, setRefreshSeconds] = useState(editing?.refreshSeconds ?? 5)
  const [presetId, setPresetId] = useState('')
  const [lat, setLat] = useState(editing?.coords ? String(editing.coords[0]) : '')
  const [lon, setLon] = useState(editing?.coords ? String(editing.coords[1]) : '')
  const [kindTouched, setKindTouched] = useState(Boolean(editing))
  const [probe, setProbe] = useState<ProbeState>({ status: 'idle' })
  const [error, setError] = useState<string>()

  // Live inference from whatever is typed, unless the user picked a type.
  const inferred = useMemo(() => inferSource(address), [address])

  useEffect(() => {
    if (kindTouched) return
    if (inferred.kind === 'image' || inferred.kind === 'mjpeg' || inferred.kind === 'hls') {
      setKind(inferred.kind)
      if (inferred.refreshSeconds) setRefreshSeconds(inferred.refreshSeconds)
    }
  }, [inferred, kindTouched])

  useEffect(() => {
    setProbe({ status: 'idle' })
  }, [address, kind])

  const applyPreset = (id: string) => {
    setPresetId(id)
    if (!id) return
    const preset = CAMERA_PRESETS.find((p) => p.id === id)
    if (!preset) return

    setKind(preset.kind)
    setKindTouched(true)
    if (preset.refreshSeconds) setRefreshSeconds(preset.refreshSeconds)

    // Fill in the path against whatever host the user has already typed.
    const host = extractHost(address)
    if (host) setAddress(`http://${host}${preset.path}`)
  }

  const canProbe = kind === 'image' || kind === 'mjpeg'

  const runTest = async () => {
    const result = inferSource(address)
    if (!result.url) {
      setProbe({ status: 'fail', message: result.problem ?? 'Enter an address first.' })
      return
    }
    if (!canProbe) {
      setProbe({
        status: 'ok',
        message:
          kind === 'hls'
            ? 'Cannot pre-test HLS from a browser — it will be attempted on play. Needs CORS headers to work.'
            : 'Embed pages cannot be pre-tested — they load only if the site allows framing.',
      })
      return
    }
    setProbe({ status: 'testing' })
    const ok = await probeReachable(result.url)
    setProbe(
      ok
        ? { status: 'ok', message: 'Reachable — the camera returned an image.' }
        : {
            status: 'fail',
            message:
              'No image came back. The camera may be offline, need a password, block cross-origin loads, or speak a different path.',
          },
    )
  }

  const handleSave = () => {
    const result = inferSource(address)
    if (result.kind === 'rtsp') {
      setError(result.problem)
      return
    }
    if (!result.url) {
      setError(result.problem ?? 'Enter a valid camera address.')
      return
    }
    if (!name.trim()) {
      setError('Give the camera a name.')
      return
    }

    const coords = parseCoords(lat, lon)
    if (coords === 'invalid') {
      setError('Latitude/longitude must both be numbers, or both left blank.')
      return
    }

    const camera: CustomCameraInput = {
      id: editing?.id ?? makeCameraId(),
      name: name.trim(),
      url: result.url,
      kind,
      operator: operator.trim() || undefined,
      addedAt: editing?.addedAt ?? new Date().toISOString(),
      ...(kind === 'image' ? { refreshSeconds: clampRefresh(refreshSeconds) } : {}),
      ...(coords ? { coords } : {}),
    }
    onSave(camera)
  }

  return (
    <div className="theater" role="dialog" aria-modal="true" aria-label="Add a camera">
      <div className="theater__backdrop" onClick={onClose} />

      <div className="dialog">
        <header className="theater__header">
          <div>
            <h2 className="theater__title">{editing ? 'Edit camera' : 'Add a camera'}</h2>
            <p className="theater__sub">
              Point it at a public camera's IP or URL. Stored only in this browser.
            </p>
          </div>
          <button type="button" className="theater__close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="dialog__body">
          <label className="field">
            <span className="field__label">Address or IP</span>
            <input
              className="field__input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="203.0.113.7  or  http://cam.example.org/mjpg/video.mjpg"
              autoFocus
            />
            {inferred.reason && address.trim() && (
              <span className="field__hint">Guess: {KIND_LABELS[safeKind(inferred.kind)] ?? inferred.kind} — {inferred.reason}</span>
            )}
            {inferred.kind === 'rtsp' && (
              <span className="field__hint field__hint--warn">{inferred.problem}</span>
            )}
          </label>

          <div className="field-row">
            <label className="field">
              <span className="field__label">Type</span>
              <select
                className="field__input"
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as CustomKind)
                  setKindTouched(true)
                }}
              >
                {(Object.keys(KIND_LABELS) as CustomKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">Brand preset</span>
              <select className="field__input" value={presetId} onChange={(e) => applyPreset(e.target.value)}>
                <option value="">Fill path from a brand…</option>
                {CAMERA_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {kind === 'image' && (
            <label className="field field--inline">
              <span className="field__label">Refresh every</span>
              <input
                type="number"
                className="field__input field__input--num"
                min={1}
                max={60}
                value={refreshSeconds}
                onChange={(e) => setRefreshSeconds(Number(e.target.value))}
              />
              <span className="field__suffix">seconds</span>
            </label>
          )}

          <div className="field-row">
            <label className="field">
              <span className="field__label">Name</span>
              <input
                className="field__input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Harbour cam"
              />
            </label>
            <label className="field">
              <span className="field__label">Operator (optional)</span>
              <input
                className="field__input"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                placeholder="Who runs it"
              />
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span className="field__label">Latitude (optional)</span>
              <input
                className="field__input"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="for the map"
                inputMode="decimal"
              />
            </label>
            <label className="field">
              <span className="field__label">Longitude (optional)</span>
              <input
                className="field__input"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                placeholder="for the map"
                inputMode="decimal"
              />
            </label>
          </div>

          <div className="dialog__test">
            <button type="button" className="btn" onClick={runTest} disabled={probe.status === 'testing'}>
              {probe.status === 'testing' ? 'Testing…' : 'Test'}
            </button>
            {probe.status === 'ok' && <span className="probe probe--ok">✓ {probe.message}</span>}
            {probe.status === 'fail' && <span className="probe probe--fail">✗ {probe.message}</span>}
            {probe.status === 'idle' && (
              <span className="probe probe--idle">
                {canProbe ? 'Loads the image once to check it responds.' : 'HLS / embed types cannot be pre-tested.'}
              </span>
            )}
          </div>

          <p className="dialog__note">
            Add cameras that a site or operator has published for viewing. This is not a scanner and
            won't find cameras left exposed by accident.
          </p>

          {error && <p className="dialog__error">{error}</p>}
        </div>

        <footer className="dialog__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={handleSave}>
            {editing ? 'Save changes' : 'Add camera'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function safeKind(kind: string): CustomKind {
  return kind === 'mjpeg' || kind === 'hls' || kind === 'iframe' ? kind : 'image'
}

function extractHost(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`).host
  } catch {
    return null
  }
}

function parseCoords(lat: string, lon: string): [number, number] | null | 'invalid' {
  const a = lat.trim()
  const b = lon.trim()
  if (!a && !b) return null
  const latNum = Number(a)
  const lonNum = Number(b)
  if (!a || !b || Number.isNaN(latNum) || Number.isNaN(lonNum)) return 'invalid'
  if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) return 'invalid'
  return [latNum, lonNum]
}

function clampRefresh(value: number): number {
  if (!Number.isFinite(value)) return 5
  return Math.min(Math.max(Math.round(value), 1), 60)
}
