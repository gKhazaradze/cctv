/**
 * Minimal client for the Windy Webcams API (v3).
 *
 * Windy retired its free public embed player, so a webcam id on its own is no
 * longer enough to show anything. With a free API key the API still returns a
 * current still frame per webcam, which is what fills the Tbilisi tiles. Key
 * goes in `.env.local` as VITE_WINDY_API_KEY — see README.
 */

import { configValue } from './runtimeConfig'

const API_ROOT = 'https://api.windy.com/webcams/api/v3'

export interface WindyWebcam {
  id: number
  title: string
  status: string
  lastUpdatedOn?: string
  images?: {
    current?: { icon?: string; thumbnail?: string; preview?: string }
    sizes?: Record<string, { width: number; height: number }>
  }
  location?: { city?: string; country?: string; latitude?: number; longitude?: number }
}

export function windyApiKey(): string | undefined {
  // Runtime `/config.js` wins over the build-time env var, so the Docker image
  // can be given a key without being rebuilt.
  return configValue('WINDY_API_KEY', 'VITE_WINDY_API_KEY')
}

export function hasWindyKey(): boolean {
  return windyApiKey() !== undefined
}

export async function fetchWindyWebcam(
  webcamId: string,
  signal?: AbortSignal,
): Promise<WindyWebcam> {
  const key = windyApiKey()
  if (!key) throw new Error('No Windy API key configured')

  const url = `${API_ROOT}/webcams/${encodeURIComponent(webcamId)}?include=images,location`
  const res = await fetch(url, { headers: { 'x-windy-api-key': key }, signal })

  if (!res.ok) {
    throw new Error(`Windy API returned ${res.status}`)
  }
  return (await res.json()) as WindyWebcam
}

/**
 * Best still frame Windy will give us, largest first.
 *
 * Free-tier image URLs carry a token that expires after ~10 minutes, so callers
 * should re-fetch rather than cache the URL for long.
 */
export function bestWindyImage(webcam: WindyWebcam): string | undefined {
  const current = webcam.images?.current
  return current?.preview ?? current?.thumbnail ?? current?.icon
}
