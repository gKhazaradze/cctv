# Where the cameras came from

A record of what was actually tested when seeding the registry, so the next
person does not repeat the same dead ends. Amsterdam and Tbilisi findings are
as of **2026-08-10**; Paris (city and airports) as of **2026-08-18**.

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

## Paris — 2 playable, 1 link-out

Paris is thin on YouTube for a city its size. Every live-filtered search for
`paris live cam`, `paris webcam`, `tour eiffel live`, `montmartre live`,
`notre dame paris live`, `la défense webcam`, `seine paris live cam`,
`champs elysées live`, `arc de triomphe live cam`, `trocadero live`,
`tour montparnasse live`, `gare du nord live cam`, `paris rooftop live`,
`paris webcam en direct` (and a few more) surfaces the same three real
cameras; everything else is a music stream with a Paris thumbnail, a
"virtual" Disneyland ambience loop, a scraped-cam compilation, or a Lyon
ring-road camera that happens to match "Périphérique".

Each candidate's watch page was fetched and checked for `"isLiveNow":true`
and `"playableInEmbed":true`, then the live thumbnail was eyeballed to make
sure it is a camera and not a graphic:

| Camera | Source | Operator | Result |
| --- | --- | --- | --- |
| Eiffel Tower from the Palais d’Iéna | video `OzYp4NRZlwQ` | Vision-Environnement (for the CESE) | live + embeddable; one stream running since 2025-04, so a video id is safe |
| Sacré-Cœur — Montmartre | channel `UCjgiKi29C--6aW3pgn0l5JA` | PARIS TV | live + embeddable — but the channel's `/streams` tab shows ~30 past broadcasts in one month, i.e. it restarts about daily and mints a new video id each time. Modelled as a **channel-follow** source, like the Heathrow entries |
| Paris skyline from Boulogne | channel `UC5VvzLNELVAwuPiMWsr2cvQ` | Paris75Webcam | live, but **embedding disabled** (oEmbed answers `401`, watch page has `playableInEmbed:false`). Kept as `kind: 'link'` to the channel's `/live` URL, and flagged `nearby` — Boulogne-Billancourt is outside the city proper |

Vision-Environnement runs dozens of French webcams on one channel (Brest,
Saint-Malo, Le Havre, Bastia airport, …), so a `channelId` source would *not*
work for them — it must stay a `videoId`. Palais d'Iéna is their only Paris
camera at the time of writing.

### Ruled out

- **EarthCam** — `earthcam.com/world/france/paris/` now redirects to the
  EarthCam home page; no Paris camera is listed.
- **Viewsurf / meteo-paris.com, PanoraMagique, earthTV** — these are the
  Paris cameras that weather aggregators (Windfinder, webcamgalore) re-host as
  stills. Each runs its own player and publishes no embeddable stream;
  meteo-paris' `/webcam` page is a 404.
- **Aggregators** (webcamtaxi, onlinewebcameras, airport-webcam.com,
  liveairportcams, city-webcams) — bot-blocked or re-hosting the above; none
  is an origin source.
- **"Carte de Surveillance EN DIRECT · Paris" (SurveillanceMap Foundation)**
  — a compilation stream, not an operator-published camera.

## Paris airports — none, and why

Checked CDG (Roissy), Orly and Le Bourget on 2026-08-18. **No operator
publishes a permanent public camera at any of them.**

- **YouTube** — live-filtered searches for `CDG live`, `Charles de Gaulle
  airport live`, `Roissy live spotting`, `LFPG live`, `Orly airport live`,
  `Le Bourget live`, `aéroport paris en direct`, `paris planespotting live`
  return exactly one Paris hit: the *Live Airways France* channel, whose
  "CDG 20", "ORY 19" and "BVA 11" streams are **departure boards** rendered
  as video, not cameras (verified from the live thumbnail). The one genuine
  spotting stream (`CAvTSeNRB6k`, "From Brussels to the Sky") was a one-off
  broadcast in July 2022 and is not live.
- **Windfinder / webcamgalore** "webcams near this airport" — the nearest
  cameras to CDG are 22–24 km away and the nearest to Orly are 14 km away, all
  of them the Paris city cameras above. Nothing at Le Bourget either.
- **Paris Air Show cams** (`cam.airlive.net/pas/`) — event-only, live for
  one week in odd-numbered Junes.
- **Groupe ADP** publishes no webcam.

So the airports collection has no Paris entry. If a real one appears, the
usual test applies: permanent 24/7 stream, live, embeddable, verified with
`npm run check:cams`.

## Re-checking

Streams die. `npm run check:cams` re-runs the live/embeddable test against every
entry, and `WINDY_API_KEY=… npm run check:cams` additionally verifies the Windy
tiles. If an Amsterdam video id goes dark, search the operator's channel for the
replacement id — WebCam.NL and ProRail restart broadcasts periodically, which
mints a new one.
