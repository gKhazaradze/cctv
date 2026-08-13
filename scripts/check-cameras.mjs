#!/usr/bin/env node
/**
 * Verifies every entry in the camera registry and reports what still works.
 *
 * Public camera feeds rot fast: streams end, operators move to a new video id,
 * a CDN starts refusing cross-origin requests. Rather than let the registry
 * quietly fill up with dead tiles, this re-checks each entry the same way the
 * browser would and tells you exactly what changed.
 *
 *   npm run check:cams          human-readable table
 *   npm run check:cams:json     machine-readable, for CI
 *
 * Exits non-zero when a camera the app claims it can play is actually broken.
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(HERE, '..', 'src', 'data')

// Each registry file and the exported array to pull out of it. collections.ts
// builds its `source` objects with `yt()`/`watch()` helpers, so those are
// re-supplied as shims when its array literal is evaluated (see loadArray).
const REGISTRIES = [
  { file: join(DATA_DIR, 'cameras.ts'), marker: 'export const cameras: Camera[] = ' },
  { file: join(DATA_DIR, 'collections.ts'), marker: 'export const collectionCameras: Camera[] = ' },
]

// Mirror of the helpers in collections.ts, so its array evaluates standalone.
const REGISTRY_HELPERS = {
  yt: (videoId) => ({ kind: 'youtube', videoId }),
  watch: (videoId) => `https://www.youtube.com/watch?v=${videoId}`,
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/** Origin we pretend to be, so CORS behaviour matches the dev server. */
const DEV_ORIGIN = 'http://localhost:5173'

const TIMEOUT_MS = 20_000
// Kept low on purpose: YouTube 429s a burst of watch-page fetches, and a 429
// tells us nothing about whether a camera is actually live.
const CONCURRENCY = 4

const jsonMode = process.argv.includes('--json')

// -------------------------------------------------------------- registry ---

/**
 * Pulls a named array out of a TypeScript source file and evaluates it.
 *
 * The registries are plain arrays of object literals (plus, in collections.ts,
 * calls to small `yt()`/`watch()` helpers that are re-supplied as shims), so
 * once the array text is isolated it evaluates as JavaScript — no TS toolchain
 * needed just to run a health check.
 *
 * The bracket scan is a small lexer that skips over strings AND comments, so
 * neither a `[` inside a URL, nor an apostrophe inside a `// comment`, nor a
 * `//` inside a string can throw the balance off.
 */
async function loadArray(file, marker) {
  const source = await readFile(file, 'utf8')
  const start = source.indexOf(marker)
  if (start === -1) throw new Error(`Could not find "${marker.trim()}" in ${file}`)

  // Start past the marker, or the `[]` in the `Camera[]` annotation would be
  // mistaken for the (empty) array literal.
  const open = source.indexOf('[', start + marker.length)
  let depth = 0
  let end = -1
  let state = 'normal' // 'normal' | 'string' | 'line-comment' | 'block-comment'
  let quote = null

  for (let i = open; i < source.length; i += 1) {
    const ch = source[i]
    const next = source[i + 1]

    if (state === 'string') {
      if (ch === '\\') i += 1 // skip the escaped char
      else if (ch === quote) state = 'normal'
      continue
    }
    if (state === 'line-comment') {
      if (ch === '\n') state = 'normal'
      continue
    }
    if (state === 'block-comment') {
      if (ch === '*' && next === '/') {
        state = 'normal'
        i += 1
      }
      continue
    }

    // state === 'normal'
    if (ch === '/' && next === '/') {
      state = 'line-comment'
      i += 1
    } else if (ch === '/' && next === '*') {
      state = 'block-comment'
      i += 1
    } else if (ch === '"' || ch === "'" || ch === '`') {
      state = 'string'
      quote = ch
    } else if (ch === '[') {
      depth += 1
    } else if (ch === ']') {
      depth -= 1
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end === -1) throw new Error(`Unbalanced brackets while reading ${file}`)

  const literal = source.slice(open, end + 1)
  const helperNames = Object.keys(REGISTRY_HELPERS)
  const fn = new Function(...helperNames, `return ${literal}`)
  return fn(...helperNames.map((n) => REGISTRY_HELPERS[n]))
}

async function loadCameras() {
  const lists = await Promise.all(REGISTRIES.map((r) => loadArray(r.file, r.marker)))
  return lists.flat()
}

// ----------------------------------------------------------------- probes ---

async function request(url, { method = 'GET', headers = {} } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9', ...headers },
    })
  } finally {
    clearTimeout(timer)
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function checkYouTube(source) {
  // Space YouTube requests out a little. With many cameras and any concurrency,
  // a burst gets HTTP 429'd — which says nothing about whether a camera is live.
  await sleep(300 + Math.floor(Math.random() * 400))

  if (source.channelId) {
    const res = await request(
      `https://www.youtube.com/embed/live_stream?channel=${source.channelId}`,
    )
    if (res.status === 429) return { ok: null, note: 'rate limited by YouTube — re-run shortly' }
    return res.ok
      ? { ok: true, note: 'channel live-stream embed reachable' }
      : { ok: false, note: `embed returned ${res.status}` }
  }

  if (!source.videoId) return { ok: false, note: 'no videoId' }

  const res = await request(`https://www.youtube.com/watch?v=${source.videoId}`)
  // 429 is throttling, not a dead camera; don't fail the run over it.
  if (res.status === 429) return { ok: null, note: 'rate limited by YouTube — re-run shortly' }
  if (!res.ok) return { ok: false, note: `watch page returned ${res.status}` }

  const html = await res.text()
  const isLive = html.includes('"isLiveNow":true') || html.includes('"isLive":true')
  const embeddable = html.includes('"playableInEmbed":true')
  const unavailable =
    html.includes('"status":"ERROR"') || html.includes('"status":"UNPLAYABLE"')

  if (unavailable) return { ok: false, note: 'video unavailable' }
  if (!embeddable) return { ok: false, note: 'live but embedding disabled' }
  if (!isLive) return { ok: false, note: 'embeddable but not currently live' }
  return { ok: true, note: 'live + embeddable' }
}

async function checkHls(source) {
  if (!source.url) return { ok: false, note: 'no url' }

  const res = await request(source.url, { headers: { origin: DEV_ORIGIN } })
  if (!res.ok) return { ok: false, note: `manifest returned ${res.status}` }

  const body = await res.text()
  if (!body.includes('#EXTM3U')) return { ok: false, note: 'not an HLS manifest' }

  const allowOrigin = res.headers.get('access-control-allow-origin')
  if (!allowOrigin) {
    return {
      ok: false,
      note: 'manifest OK but no CORS header — browser playback will fail',
    }
  }
  return { ok: true, note: `manifest OK, CORS ${allowOrigin}` }
}

async function checkImageLike(source, label) {
  if (!source.url) return { ok: false, note: 'no url' }

  const res = await request(source.url, { headers: { origin: DEV_ORIGIN } })
  if (!res.ok) return { ok: false, note: `returned ${res.status}` }

  const type = res.headers.get('content-type') ?? 'unknown'
  if (!type.startsWith('image') && !type.includes('multipart')) {
    return { ok: false, note: `unexpected content-type ${type}` }
  }
  return { ok: true, note: `${label} OK (${type})` }
}

async function checkIframe(source) {
  if (!source.url) return { ok: false, note: 'no url' }

  const res = await request(source.url)
  if (!res.ok) return { ok: false, note: `returned ${res.status}` }

  const xfo = (res.headers.get('x-frame-options') ?? '').toLowerCase()
  if (xfo.includes('deny') || xfo.includes('sameorigin')) {
    return { ok: false, note: `X-Frame-Options: ${xfo} — cannot be embedded` }
  }
  return { ok: true, note: 'embeddable' }
}

async function checkWindy(source) {
  const key = process.env.WINDY_API_KEY ?? process.env.VITE_WINDY_API_KEY
  if (!key) return { ok: null, note: 'skipped — set WINDY_API_KEY to verify' }
  if (!source.webcamId) return { ok: false, note: 'no webcamId' }

  const res = await request(
    `https://api.windy.com/webcams/api/v3/webcams/${source.webcamId}?include=images`,
    { headers: { 'x-windy-api-key': key } },
  )
  if (!res.ok) return { ok: false, note: `Windy API returned ${res.status}` }

  const data = await res.json()
  const image = data?.images?.current?.preview ?? data?.images?.current?.thumbnail
  if (!image) return { ok: false, note: 'no current image' }
  return { ok: true, note: `frame available (status: ${data.status ?? 'unknown'})` }
}

async function checkLink(camera) {
  const url = camera.source.url ?? camera.pageUrl
  if (!url) return { ok: null, note: 'link-only, no URL recorded' }

  try {
    const res = await request(url)
    // A bot-blocking 403 does not mean the page is gone for a real viewer.
    if (res.status === 403 || res.status === 429) {
      return { ok: null, note: `link-only — source returned ${res.status} to a bot` }
    }
    return res.ok
      ? { ok: null, note: 'link-only — source page reachable' }
      : { ok: null, note: `link-only — source page returned ${res.status}` }
  } catch (err) {
    // Never fails the run: the app only ever links to these, so an unreachable
    // source is worth surfacing but is not a broken promise on our side.
    const reason = err?.cause?.code ?? err?.cause?.message ?? err?.message ?? 'unreachable'
    return { ok: null, note: `link-only — could not reach source (${reason})` }
  }
}

async function checkCamera(camera) {
  const { source } = camera
  try {
    switch (source.kind) {
      case 'youtube':
        return await checkYouTube(source)
      case 'hls':
        return await checkHls(source)
      case 'image':
        return await checkImageLike(source, 'still')
      case 'mjpeg':
        return await checkImageLike(source, 'mjpeg')
      case 'iframe':
        return await checkIframe(source)
      case 'windy':
        return await checkWindy(source)
      case 'link':
        return await checkLink(camera)
      default:
        return { ok: false, note: `unknown source kind "${source.kind}"` }
    }
  } catch (err) {
    const reason = err?.name === 'AbortError' ? 'timed out' : err?.message ?? String(err)
    return { ok: false, note: reason }
  }
}

/** Runs probes with a small concurrency cap so we do not hammer operators. */
async function mapLimited(items, limit, fn) {
  const results = new Array(items.length)
  let cursor = 0

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await fn(items[index], index)
    }
  })

  await Promise.all(workers)
  return results
}

// ------------------------------------------------------------------ output ---

const useColor = process.stdout.isTTY && !process.env.NO_COLOR
const code = (n) => (useColor ? `\u001b[${n}m` : '')

const GREEN = code(32)
const RED = code(31)
const YELLOW = code(33)
const DIM = code(2)
const RESET = code(0)

function symbol(ok) {
  if (ok === true) return `${GREEN}✔${RESET}`
  if (ok === false) return `${RED}✘${RESET}`
  return `${YELLOW}—${RESET}`
}

async function main() {
  const cameras = await loadCameras()
  const results = await mapLimited(cameras, CONCURRENCY, async (camera) => {
    const result = await checkCamera(camera)
    return { camera, ...result }
  })

  if (jsonMode) {
    console.log(
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          results: results.map((r) => ({
            id: r.camera.id,
            cityId: r.camera.cityId,
            name: r.camera.name,
            kind: r.camera.source.kind,
            ok: r.ok,
            note: r.note,
          })),
        },
        null,
        2,
      ),
    )
  } else {
    const byCity = new Map()
    for (const result of results) {
      const list = byCity.get(result.camera.cityId) ?? []
      list.push(result)
      byCity.set(result.camera.cityId, list)
    }

    for (const [cityId, list] of byCity) {
      console.log(`\n${cityId}`)
      for (const { camera, ok, note } of list) {
        const name = camera.name.padEnd(34).slice(0, 34)
        const kind = `${DIM}${camera.source.kind.padEnd(7)}${RESET}`
        console.log(`  ${symbol(ok)} ${name} ${kind} ${DIM}${note}${RESET}`)
      }
    }
  }

  const broken = results.filter((r) => r.ok === false)
  const working = results.filter((r) => r.ok === true)
  const skipped = results.filter((r) => r.ok === null)

  if (!jsonMode) {
    console.log(
      `\n${working.length} working · ${broken.length} broken · ${skipped.length} informational`,
    )
    if (broken.length > 0) {
      console.log(`${RED}Broken:${RESET} ${broken.map((b) => b.camera.id).join(', ')}`)
    }
  }

  process.exit(broken.length > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
