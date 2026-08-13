# Where the cameras came from

A record of what was actually tested when seeding the registry, so the next
person does not repeat the same dead ends. Findings are as of **2026-08-10**.

## The test each candidate had to pass

A camera is only marked playable in-app if it satisfies all of:

1. **Public** — published by its operator for general viewing.
2. **Live** — currently streaming, not an archived video or a dead 24/7 loop.
3. **Embeddable** — the operator permits third-party playback, and the server
   agrees: no blocking `X-Frame-Options`, and no `403` on cross-origin requests.

Anything failing (3) but passing (1) and (2) is kept as `kind: 'link'` rather
than dropped, so the registry stays a truthful map of what exists in the city.

## Amsterdam — 8 playable

Amsterdam is unusually well served because several Dutch operators
(WebCam.NL, Now4Rent, ProRail, Bouwwebcam) publish their cameras as **public
YouTube live streams**, which are embeddable by design.

All eight were confirmed `live + embeddable` by fetching each watch page and
checking `"isLiveNow":true` alongside `"playableInEmbed":true`:

| Camera | Video id | Operator |
| --- | --- | --- |
| Dam Square | `Gd9d4q6WvUY` | Now4Rent.NL |
| Damrak & Beursplein | `43qH0tDA6lM` | WebCam.NL |
| Centraal — Stationseiland | `1phWWCgzXgM` | Bouwwebcam |
| De Vijf Bruggen cam 1 | `2tgHBRFHMm8` | ProRail |
| De Vijf Bruggen cam 2 | `FHJH2yMe6Hw` | ProRail |
| Oosterdok rooftop | `9Pm6Ji6tm7s` | Mövenpick |
| Sixhaven — IJ waterfront | `3gTHiUWrCAE` | WebCam.NL |
| Zaanse Schans | `o9MIV7sep5k` | WebCam.NL |

Zaanse Schans is ~15 km outside the city and is flagged `nearby: true` so it
does not inflate Amsterdam's headline count.

WebCam.NL's channel id is `UC3Bo0LNAeN_g5U4NJQDnL-w`, useful if you want to
switch an entry to a `channelId` source that follows whatever they have live.

## Tbilisi — 0 playable without a key, and why

This is the honest finding: **no Tbilisi camera currently publishes a stream a
third-party page is allowed to embed.** Everything checked, and what happened:

### EarthCam — two cameras, both blocked

EarthCam runs the two best-known Tbilisi cameras: *Freedom Square* (from the
Courtyard Marriott) and *Mtkvari River* (from the Golden Tulip Design hotel).
Their HLS manifests are discoverable on the page:

```
https://videos-3.earthcam.com/fecnetwork/17101.flv/playlist.m3u8   # Freedom Square
https://videos-3.earthcam.com/fecnetwork/22237.flv/playlist.m3u8   # Mtkvari River
```

The Freedom Square manifest requires a short-lived token (`?t=…&td=…`) minted on
the page. The Mtkvari one returns `200` without a token — but only to a request
with **no `Origin` header**. Send `Origin: http://localhost:5173` and the same
URL returns `403`, at both the manifest and chunklist level.

The `earthcamtv.com/embed.php` embed also answers `X-Frame-Options: SAMEORIGIN`.

Both of those are deliberate access controls on a commercial service. Refreshing
their tokens by scraping, or stripping `Origin` through a proxy, would be
circumventing them — so these are `kind: 'link'`.

### Windy — database has them, free embed player is gone

Windy hosts several Tbilisi webcams:

| Webcam | Id |
| --- | --- |
| Saakadze Square | `1248808440` |
| Radisson Blu Iveria | `1512053148` |
| Sameba Cathedral | `1270407724` |

The legacy embed player URL still returns `200`, but the body is now just:

> Sorry. The embed player for this webcam is not publicly available.

The v2/v3 player paths `404`. So a webcam id alone renders nothing. With a free
API key the v3 API does return a current still frame per webcam, which is what
`kind: 'windy'` uses — labelled `STILLS` in the UI, since the free tier is
images, not video.

### Kamerebi.live — Georgian operator, no public stream endpoint

Runs 24/7 cameras in Tbilisi and is the most promising local source, but the
site sits behind Cloudflare and returns `403` to non-browser clients, so no
stream URL could be confirmed. It also serves an **incomplete certificate
chain** (missing intermediate), which strict clients reject — browsers usually
recover by fetching the intermediate themselves. Kept as `kind: 'link'`; the
health check reports it as a warning rather than a failure.

### Ruled out

- **YouTube** — searched the live-filtered results for `Tbilisi`,
  `Tbilisi webcam`, `Georgia Tbilisi live`, `Rustaveli Tbilisi live` and
  `თბილისი live`. No Tbilisi live stream exists on the platform.
- **SkylineWebcams** — its Tbilisi page lists no cameras, only language variants
  of the empty page.
- **Aggregators** (webcamtaxi, worldcam.eu, worldviewstream, city-webcams,
  scs.com.ua) — all re-host EarthCam or Windy, or were offline. None is an
  origin source.
- **IPTV playlists** — carry Georgian TV channels, not city cameras.

## Re-checking

Streams die. `npm run check:cams` re-runs the live/embeddable test against every
entry, and `WINDY_API_KEY=… npm run check:cams` additionally verifies the Windy
tiles. If an Amsterdam video id goes dark, search the operator's channel for the
replacement id — WebCam.NL and ProRail restart broadcasts periodically, which
mints a new one.
