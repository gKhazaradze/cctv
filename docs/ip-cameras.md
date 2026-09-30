# Adding cameras by IP or URL

CityWatch can show any public camera you point it at, not just the built-in
registry. Click **+ Add camera**, paste an address, and it appears under a **My
cameras** group. Your added cameras live in your browser's local storage — they
are never uploaded anywhere and are not part of the shared, checked-in registry.

## What kind of camera works, and why

A browser can only play certain things directly. The dialog's **Type** field
picks how the feed is loaded:

| Type | What it is | Works in-browser? |
| --- | --- | --- |
| **Snapshot (JPEG)** | A still image the camera overwrites; we re-fetch it on a timer | ✅ Yes — even across origins |
| **MJPEG stream** | Motion-JPEG, a continuous stream of frames | ✅ Yes — even across origins |
| **HLS (.m3u8)** | Adaptive stream used by many modern cams/CDNs | ⚠️ Only if the camera/CDN sends CORS headers |
| **Embed page (iframe)** | The operator's own web page | ⚠️ Only if the page allows being framed |
| **RTSP** | The protocol most security cameras speak | ❌ Not directly — needs the bridge below |

The reason snapshots and MJPEG "just work" is that the browser loads them into an
`<img>` tag, which is allowed to *display* another site's image without
permission (it just can't read the pixels). HLS is fetched with JavaScript, which
**does** need the camera's server to opt in via CORS — so an HLS camera that
plays fine in its own page may still fail here, and there's nothing the app can
do about that from the browser.

## The "Test" button

For snapshot and MJPEG cameras, **Test** actually loads the image once and tells
you whether it responded. It's the only reachability check a browser can do
cross-origin, so HLS and iframe types can't be pre-tested — they're attempted
when the tile plays.

A failed test usually means one of: the camera is offline, it needs a password,
it blocks cross-origin loads, or the path is wrong (try a **Brand preset**).

## Brand presets

The **Brand preset** dropdown fills in the default endpoint path for common
camera makes (Axis, Dahua, Hikvision, Mobotix, Foscam, plus generic MJPEG and
snapshot paths) against whatever host you've typed. These are manufacturer
defaults for cameras whose owner has enabled anonymous viewing — a convenience,
not a way past a login.

## HTTP vs HTTPS — a gotcha

Most IP cameras are plain **HTTP**. This app is served over HTTP by default
(nginx in the container, or the Vite dev server), so HTTP cameras load fine.

If you later put CityWatch behind HTTPS (say, Caddy with a certificate), browsers
will **block** plain-HTTP camera images as "mixed content" and the tiles will go
blank. Options then: use cameras that offer HTTPS, or keep CityWatch on HTTP on
your LAN.

The container's Content-Security-Policy is deliberately set to allow `http:` and
`https:` image/media/frame sources for exactly this reason (see
`docker/security-headers.conf`). Script execution stays locked to the app itself.

## RTSP cameras (the optional bridge)

Most security-style IP cameras only speak **RTSP**, which no browser can play.
CityWatch ships an optional [go2rtc](https://github.com/AlexxIT/go2rtc) service
that converts RTSP (and RTMP, and more) into browser-friendly HLS/WebRTC.

1. List your cameras in `docker/go2rtc.yaml`:

   ```yaml
   streams:
     backyard: rtsp://user:pass@192.168.1.50:554/Streaming/Channels/101
   ```

2. Start the bridge, on your own machine:

   ```bash
   docker compose -f docker-compose.rtsp.yml up -d
   ```

3. Confirm it connects at `http://localhost:1984` (go2rtc's dashboard).

4. In **+ Add camera**, choose type **HLS** and use:

   ```
   http://localhost:1984/api/stream.m3u8?src=backyard
   ```

**It stays on your machine, on purpose.** go2rtc's API has no login and can add
`exec:` sources, which run commands, so anyone who can reach port 1984 can run
code on that computer. The compose file therefore publishes it on `127.0.0.1`
only, and it is not part of the production compose at all: the public site is
HTTPS, which can't load these plain-HTTP streams anyway. To watch from another
device, change the port line to `"1984:1984"`, and only on a network where you
trust every device.

Because go2rtc runs on the same host and adds permissive CORS, the HLS stream it
produces plays where a raw camera HLS URL often wouldn't.

> The go2rtc profile is scaffolding you point at your own cameras — there's no
> public RTSP source bundled to demo it against.

## The line this feature draws

This adds cameras a site or operator has **published** for viewing. It is not a
scanner and won't discover cameras that happen to be reachable because someone
forgot to set a password. Those are overwhelmingly private cameras whose owners
never agreed to be watched — a different thing entirely, and not something this
project does.
