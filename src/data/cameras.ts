import type { Camera } from '../types'

/**
 * The camera registry.
 *
 * Every `youtube` entry below was confirmed live *and* publicly embeddable on
 * the `verifiedAt` date. Streams do die — run `npm run check:cams` to re-verify
 * the whole list and see what has gone dark since.
 *
 * Cameras that are public to watch but that their operator does not allow to be
 * re-embedded are kept as `kind: 'link'` rather than being scraped around. See
 * `docs/sources.md` for why each Tbilisi camera landed where it did.
 */
export const cameras: Camera[] = [
  // ---------------------------------------------------------------------------
  // Amsterdam, Netherlands
  // ---------------------------------------------------------------------------
  {
    id: 'ams-dam-square',
    cityId: 'amsterdam',
    name: 'Dam Square',
    description:
      'Pan-tilt-zoom camera over De Dam, looking across to the Royal Palace and the National Monument.',
    operator: 'Now4Rent.NL',
    pageUrl: 'https://www.youtube.com/watch?v=Gd9d4q6WvUY',
    coords: [52.3731, 4.8926],
    tags: ['square', 'landmark', '4K', 'PTZ'],
    source: { kind: 'youtube', videoId: 'Gd9d4q6WvUY' },
    verifiedAt: '2026-08-10',
  },
  {
    id: 'ams-damrak-beursplein',
    cityId: 'amsterdam',
    name: 'Damrak & Beursplein',
    description:
      'Ultra-HD PTZ camera on Beursplein, framing the Beurs van Berlage and the Damrak approach from Centraal.',
    operator: 'WebCam.NL',
    pageUrl: 'https://www.youtube.com/watch?v=43qH0tDA6lM',
    coords: [52.3752, 4.8956],
    tags: ['street', 'landmark', '4K', 'PTZ'],
    source: { kind: 'youtube', videoId: '43qH0tDA6lM' },
    verifiedAt: '2026-08-10',
  },
  {
    id: 'ams-stationseiland',
    cityId: 'amsterdam',
    name: 'Centraal Station — Stationseiland',
    description:
      'Construction camera overlooking Stationseiland and the front of Amsterdam Centraal.',
    operator: 'Bouwwebcam',
    pageUrl: 'https://www.youtube.com/watch?v=1phWWCgzXgM',
    coords: [52.3785, 4.8998],
    tags: ['transport', 'street'],
    source: { kind: 'youtube', videoId: '1phWWCgzXgM' },
    verifiedAt: '2026-08-10',
  },
  {
    id: 'ams-vijf-bruggen-1',
    cityId: 'amsterdam',
    name: 'De Vijf Bruggen — camera 1',
    description:
      'ProRail works camera on the five-bridges rail approach immediately west of Centraal Station.',
    operator: 'ProRail',
    pageUrl: 'https://www.youtube.com/watch?v=2tgHBRFHMm8',
    coords: [52.3776, 4.8983],
    tags: ['transport', 'rail'],
    source: { kind: 'youtube', videoId: '2tgHBRFHMm8' },
    verifiedAt: '2026-08-10',
  },
  {
    id: 'ams-vijf-bruggen-2',
    cityId: 'amsterdam',
    name: 'De Vijf Bruggen — camera 2',
    description: 'Second ProRail angle on the same five-bridges rail crossing.',
    operator: 'ProRail',
    pageUrl: 'https://www.youtube.com/watch?v=FHJH2yMe6Hw',
    coords: [52.3776, 4.8983],
    tags: ['transport', 'rail'],
    source: { kind: 'youtube', videoId: 'FHJH2yMe6Hw' },
    verifiedAt: '2026-08-10',
  },
  {
    id: 'ams-movenpick-rooftop',
    cityId: 'amsterdam',
    name: 'Oosterdok rooftop panorama',
    description:
      'Panoramic rooftop view from the Mövenpick over the Oosterdok, the IJ and the eastern docklands.',
    operator: 'Mövenpick Hotel Amsterdam City Centre',
    pageUrl: 'https://www.youtube.com/watch?v=9Pm6Ji6tm7s',
    coords: [52.3776, 4.9107],
    tags: ['panorama', 'skyline', 'water'],
    source: { kind: 'youtube', videoId: '9Pm6Ji6tm7s' },
    verifiedAt: '2026-08-10',
  },
  {
    id: 'ams-sixhaven',
    cityId: 'amsterdam',
    name: 'Sixhaven — IJ waterfront',
    description:
      'Camera in Amsterdam-Noord looking south across the IJ towards the city centre and Centraal Station.',
    operator: 'WebCam.NL',
    pageUrl: 'https://www.youtube.com/watch?v=3gTHiUWrCAE',
    coords: [52.3862, 4.9007],
    tags: ['water', 'harbour', 'skyline'],
    source: { kind: 'youtube', videoId: '3gTHiUWrCAE' },
    verifiedAt: '2026-08-10',
  },
  {
    id: 'ams-zaanse-schans',
    cityId: 'amsterdam',
    name: 'Zaanse Schans windmills',
    description:
      'Ultra-HD PTZ camera on the historic windmills at Zaanse Schans, about 15 km north-west of the city.',
    operator: 'WebCam.NL',
    pageUrl: 'https://www.youtube.com/watch?v=o9MIV7sep5k',
    coords: [52.4746, 4.8203],
    tags: ['landmark', 'heritage', '4K', 'PTZ'],
    nearby: true,
    source: { kind: 'youtube', videoId: 'o9MIV7sep5k' },
    verifiedAt: '2026-08-10',
  },

  // ---------------------------------------------------------------------------
  // Tbilisi, Georgia
  //
  // No Tbilisi camera currently publishes a stream that a third-party page is
  // allowed to embed: EarthCam answers any cross-origin request with 403 and
  // sends X-Frame-Options: SAMEORIGIN, and Windy retired its free embed player.
  // These are therefore modelled honestly as `link` / `windy` rather than being
  // scraped. `windy` entries turn into live frames as soon as a free API key is
  // present — see README.
  // ---------------------------------------------------------------------------
  {
    id: 'tbs-freedom-square',
    cityId: 'tbilisi',
    name: 'Freedom Square',
    description:
      'Looks down on Tavisuplebis Moedani and the gilded St George column from the Courtyard Marriott.',
    operator: 'EarthCam',
    pageUrl: 'https://www.earthcam.com/world/georgia/tbilisi/?cam=tbilisi',
    coords: [41.6934, 44.8015],
    tags: ['square', 'landmark'],
    source: { kind: 'link', url: 'https://www.earthcam.com/world/georgia/tbilisi/?cam=tbilisi' },
    verifiedAt: '2026-08-10',
  },
  {
    id: 'tbs-mtkvari-river',
    cityId: 'tbilisi',
    name: 'Mtkvari River',
    description:
      'View over the Mtkvari (Kura) and the old town, from the roof of the Golden Tulip Design hotel.',
    operator: 'EarthCam',
    pageUrl: 'https://www.earthcam.com/world/georgia/tbilisi/',
    coords: [41.6975, 44.801],
    tags: ['river', 'panorama'],
    source: { kind: 'link', url: 'https://www.earthcam.com/world/georgia/tbilisi/' },
    verifiedAt: '2026-08-10',
  },
  {
    id: 'tbs-kamerebi-live',
    cityId: 'tbilisi',
    name: 'Kamerebi.live city cameras',
    description:
      'Georgian operator running 24/7 cameras in Tbilisi, including one on the right bank of the Mtkvari.',
    // Their server sends an incomplete certificate chain, so strict clients
    // (including `npm run check:cams`) fail to verify it. Browsers usually
    // recover by fetching the missing intermediate themselves.
    operator: 'Kamerebi.live',
    pageUrl: 'https://www.kamerebi.live/tbilisi/',
    coords: [41.7151, 44.8271],
    tags: ['street', 'local'],
    source: { kind: 'link', url: 'https://www.kamerebi.live/tbilisi/' },
    verifiedAt: '2026-08-10',
  },
  {
    id: 'tbs-saakadze-square',
    cityId: 'tbilisi',
    name: 'Saakadze Square',
    description: 'Windy-hosted webcam over Giorgi Saakadze Square.',
    operator: 'Windy webcams',
    pageUrl: 'https://www.windy.com/webcams/1248808440',
    coords: [41.6906, 44.8085],
    tags: ['square', 'street'],
    source: { kind: 'windy', webcamId: '1248808440' },
    verifiedAt: '2026-08-10',
  },
  {
    id: 'tbs-radisson-iveria',
    cityId: 'tbilisi',
    name: 'Radisson Blu Iveria',
    description: 'Windy-hosted webcam from the Radisson Blu Iveria on Rose Revolution Square.',
    operator: 'Windy webcams',
    pageUrl: 'https://www.windy.com/webcams/1512053148',
    coords: [41.6968, 44.7995],
    tags: ['panorama', 'skyline'],
    source: { kind: 'windy', webcamId: '1512053148' },
    verifiedAt: '2026-08-10',
  },
  {
    id: 'tbs-sameba',
    cityId: 'tbilisi',
    name: 'Sameba Cathedral',
    description: 'Windy-hosted webcam pointed at the Holy Trinity (Sameba) cathedral on Elia hill.',
    operator: 'Windy webcams',
    pageUrl: 'https://www.windy.com/webcams/1270407724',
    coords: [41.6977, 44.8189],
    tags: ['landmark', 'heritage'],
    source: { kind: 'windy', webcamId: '1270407724' },
    verifiedAt: '2026-08-10',
  },

  // ---------------------------------------------------------------------------
  // Gudauri, Georgia (ski resort)
  // ---------------------------------------------------------------------------
  {
    id: 'gud-cafe-vitamin',
    cityId: 'gudauri',
    name: 'Cafe Vitamin',
    description: 'Live view over Gudauri from Cafe Vitamin, looking across the resort and slopes.',
    operator: 'Cafe Vitamin Gudauri',
    pageUrl: 'https://www.youtube.com/watch?v=QJ63HspHB6M',
    coords: [42.4785, 44.4795],
    tags: ['ski', 'mountain', 'cafe'],
    source: { kind: 'youtube', videoId: 'QJ63HspHB6M' },
    verifiedAt: '2026-08-10',
  },
  {
    id: 'gud-carpe-diem',
    cityId: 'gudauri',
    // Published via ipcamlive and reachable/embeddable, but the hotel's camera
    // is not always streaming — the player shows an offline notice when it is
    // down. No `verifiedAt`: confirmed embeddable, not confirmed live.
    name: 'Hotel Carpe Diem',
    description: 'Hotel webcam over the Gudauri slopes (may show offline when the camera is down).',
    operator: 'Hotel Carpe Diem (via ipcamlive)',
    pageUrl: 'https://www.gudauri.info/webcam/',
    coords: [42.481, 44.474],
    tags: ['ski', 'mountain', 'hotel'],
    source: { kind: 'iframe', url: 'https://g2.ipcamlive.com/player/player.php?alias=5df6407e5ca46' },
  },
]

export function camerasForCity(cityId: string): Camera[] {
  return cameras.filter((c) => c.cityId === cityId)
}

/** Cameras that can actually play inside the app, as opposed to linking out. */
export function isEmbeddable(camera: Camera): boolean {
  return camera.source.kind !== 'link'
}

export function playableCountForCity(cityId: string): number {
  return cameras.filter((c) => c.cityId === cityId && isEmbeddable(c)).length
}
