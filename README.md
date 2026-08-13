# CityWatch

Browse public live camera feeds from around the world — city centres, plus
curated **collections** of interesting cams (zoos & aquariums, wildlife & safari,
landmarks, beaches). Ships with **Tbilisi** and **Amsterdam** as geographic
cities and **55+ verified live feeds** in total.

- A wall of live feeds per place, with a configurable number auto-playing
- **Collections** of published public cams grouped by subject — otters, pandas,
  African waterholes, Times Square, Maho Beach, and more
- **Add your own** cameras by IP or URL (see below)
- Map view (Leaflet + OpenStreetMap) showing where every camera sits worldwide,
  with a **Fit all** button and a drag-to-resize panel
- Theater mode with keyboard navigation (`←` `→` to walk cameras, `Esc` to close)
- Each city's own wall-clock time and a real solar-position readout, so a dark
  feed reads as "it's 3am there" rather than "this is broken"
- `npm run check:cams` re-verifies every feed, because public cameras rot

Every camera in the collections is an operator-published YouTube live stream,
verified live **and** embeddable — these are feeds put out for public viewing,
not cameras found by scanning for weak security.

## Quickstart (Docker)

The shared edge network exists once per machine:

```bash
docker network create web        # once, if you've never run a platform project
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
# → http://localhost:8080
```

The overlay is what publishes the host port. The base `docker-compose.yml` is
the **production** shape — network-only, no host ports, because on the server
Caddy is the only thing that binds the edge (see [Deployment](#deployment)).
Running the base file alone starts the container but leaves nothing to open in a
browser.

The container is set to `restart: unless-stopped`, so it comes back by itself
after a reboot or a Docker restart — you never have to start it by hand again.

```bash
docker compose logs -f    # follow logs
docker compose restart    # restart
docker compose down       # stop and remove
```

Change the port with `CITYWATCH_PORT` (in `.env` or inline):

```bash
CITYWATCH_PORT=9000 docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

### Other compose services

```bash
# Hot-reloading dev server against your working tree, on :5173
docker compose --profile dev up dev

# Verify every camera still works, inside the container
docker compose --profile tools run --rm check
```

Both are profile-gated, so a plain `up -d` only ever starts the app. The dev
service is deliberately `restart: "no"` — it should come up when you ask for it,
not after every reboot.

## Deployment

CityWatch is a project on the [platform](https://github.com/gKhazaradze/my_home_page)
— one box where a single Caddy container owns `:80`/`:443`, terminates TLS, and
reverse-proxies each project subdomain to a project container by name over the
shared `web` Docker network. This repo holds up its end of that contract:

- `container_name: citywatch` — the stable name Caddy targets
- `networks: [web]`, declared `external` — the platform owns that network
- no `ports:` in the production compose — Caddy binds the host edge, not us
- nginx listens on a fixed `:80` inside the container

so the platform side is one `reverse_proxy citywatch:80` block plus one card in
its registry. The app itself needed no code changes: a subdomain keeps it at the
site root, so root-relative asset paths keep working.

### The image is built in CI, never on the server

`git push` to `main` runs [the workflow](.github/workflows/main.yml): validate
both compose files, build the image on the runner (its build stage runs
`tsc --noEmit && vite build`, so a type error fails the deploy and nothing is
pushed), push it to `ghcr.io/gkhazaradze/citywatch`, then SSH to the box to
`git reset --hard` `/srv/citywatch`, **pull** that image, start it with
`--no-build`, and health-check nginx *inside* the container (there's no host
port to probe from outside).

The build location is the whole point. That box has **909 MB of RAM, 2 vCPUs and
no swap**, and with the other three projects running there's ~380 MB free. A
Rollup build wants 0.5–1.5 GB — attempting one there exhausted memory and wedged
the entire instance, taking every site on it down until a reboot. The runner has
7 GB and no production traffic. Don't move the build back.

Repo secrets it needs: `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY` (the same deploy key
the other projects use) and `CITYWATCH_URL` for the public post-deploy check. The
registry needs no secret — GHCR packages default to private even for a public
repo, so the deploy logs in with the run's own `GITHUB_TOKEN` and logs out after,
leaving no long-lived credential on the server.

No manual first-deploy step: if `/srv/citywatch` doesn't exist yet the workflow
clones it (the repo is public, so the server needs no credentials) and hands
ownership to the login user, so every later deploy is a plain fetch + reset.

Every build is also tagged with its commit sha, so a rollback is one command on
the box:

```bash
cd /srv/citywatch
CITYWATCH_TAG=<git-sha> sudo -E docker compose up -d --no-build app
```

## Running without Docker

Needs Node 18+; the repo pins a version in `.nvmrc`:

```bash
nvm use              # or: nvm install
npm install
npm run dev          # http://localhost:5173

npm run build        # typecheck + production bundle into dist/
npm run preview      # serve the production build
npm run check:cams   # verify every camera in the registry
```

## Add your own cameras by IP or URL

Click **+ Add camera** to point CityWatch at any public camera — a snapshot
JPEG, an MJPEG stream, an HLS feed, or an embed page. Paste an IP or full URL,
optionally pick a **brand preset** (Axis, Dahua, Hikvision, Mobotix, Foscam, …)
to fill in the path, and hit **Test** to check it responds. Your cameras appear
under a **My cameras** group and are stored only in your browser.

Snapshot and MJPEG cameras play directly, even across origins. RTSP cameras (most
security cams) need the optional [go2rtc](https://github.com/AlexxIT/go2rtc)
bridge — `docker compose --profile rtsp up -d go2rtc`. Full details, including the
HTTP-vs-HTTPS mixed-content gotcha, are in [`docs/ip-cameras.md`](docs/ip-cameras.md).

This adds cameras an operator has **published** — it is not a scanner and won't
find cameras left exposed by accident.

## How sources are chosen

Only cameras their operator has published for public viewing are included, and
every tile credits the operator with a link back to the source.

The registry distinguishes cameras that can be *played here* from cameras that
can only be *watched at the source*. That distinction is deliberate: several
well-known city cameras are free to watch but are not licensed or technically
permitted to be re-embedded, and the app links out to those rather than working
around the operator. Nothing in this project scrapes tokens, strips `Origin`
headers, or otherwise routes around an operator that is refusing third-party
playback.

`docs/sources.md` records what was tested per city and why each camera ended up
in the category it did.

### What you get out of the box

| City | Playable in-app | Link-out only |
| --- | --- | --- |
| Amsterdam | 8 YouTube live streams (Dam Square, Damrak, Centraal, Oosterdok, Sixhaven, Zaanse Schans) | — |
| Tbilisi | 3 Windy webcams (needs a free key, see below) | 3 (EarthCam ×2, Kamerebi.live) |

Tbilisi is thinner than Amsterdam for a structural reason, not an oversight: at
the time of writing no Tbilisi camera publishes a stream that a third-party page
is allowed to embed. See `docs/sources.md`.

## Optional: Windy API key

Windy hosts a large public webcam database, including several in Tbilisi, but
retired its free embed player — a webcam id alone no longer renders anything. A
free API key restores those tiles as periodically-refreshed still frames.

Create a key at <https://api.windy.com/keys> (pick the *Webcams* product), then:

**With Docker** — the key is read at container start-up, so a restart is enough;
no rebuild needed. Put it in `.env` next to `docker-compose.yml`:

```
WINDY_API_KEY=your_key_here
```

```bash
docker compose up -d       # picks up the new value
```

The container writes `/config.js` from its environment before nginx starts, and
the app reads that in preference to anything baked in at build time.

**Without Docker** — put it in `.env.local` and restart `npm run dev`:

```
VITE_WINDY_API_KEY=your_key_here
```

Windy tiles are labelled `STILLS` in the UI, because that is what the free tier
serves — a recent frame, not live video.

## Adding a camera (to the shipped registry)

- **A geographic city** → add cameras to `src/data/cameras.ts` (and the city to
  `src/data/cities.ts` if new).
- **A collection** → add cameras to `src/data/collections.ts` (and a new
  collection group there if needed). Collection cams use the `yt('<videoId>')`
  helper for YouTube live streams.

Then verify — the health check scans both files:

```bash
npm run check:cams
```

The `source.kind` field decides how it plays:

| kind | Use when | Key fields |
| --- | --- | --- |
| `youtube` | Operator runs a public, embeddable live stream | `videoId`, or `channelId` to follow whatever a channel has live |
| `hls` | Open `.m3u8` manifest served with permissive CORS | `url` |
| `mjpeg` | `multipart/x-mixed-replace` stream | `url` |
| `image` | A still the operator overwrites on a cadence | `url`, `refreshSeconds` |
| `iframe` | Operator provides an embed page meant to be framed | `url` |
| `windy` | Camera lives in Windy's database | `webcamId` |
| `link` | Public to watch, but not embeddable | `url` / `pageUrl` |

Prefer `channelId` over `videoId` for YouTube where the channel runs a single
persistent stream — it survives the operator restarting their broadcast.

## Keeping the registry honest

`npm run check:cams` probes each entry the way a browser would: YouTube entries
are checked for both *live* and *embeddable*, HLS manifests are fetched with an
`Origin` header so a missing CORS header is caught, and `iframe` entries are
rejected if the server sends a blocking `X-Frame-Options`.

It exits non-zero when a camera the app claims it can play is actually broken,
so it works as a CI check. Link-only entries are reported but never fail the
run — the app makes no playback promise about them.

```bash
npm run check:cams:json    # same data as JSON
WINDY_API_KEY=… npm run check:cams   # also verify the Windy entries
```

## Optional dev stream proxy

Some operators publish an open HLS manifest but never set CORS headers, which
makes it unplayable from a web page even though the URL is public. For those
cases only, `vite.config.ts` exposes an opt-in pass-through:

```bash
STREAM_PROXY_ORIGIN=https://example-operator.tld npm run dev
```

then set `viaProxy: true` on that camera's source. It is off by default and
dev-only. Use it for operators who permit third-party playback but have a
misconfigured CDN — not to get around one who is deliberately refusing it.

## Attribution

Camera feeds belong to their operators, credited on every tile. Map tiles are
© [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors and
© [CARTO](https://carto.com/attributions).
