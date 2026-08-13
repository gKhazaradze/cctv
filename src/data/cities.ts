import type { City } from '../types'

/**
 * Cities the app knows about. Adding one is just adding an entry here plus its
 * cameras in `cameras.ts` — nothing else in the app is city-aware.
 */
export const cities: City[] = [
  {
    id: 'tbilisi',
    name: 'Tbilisi',
    localName: 'თბილისი',
    country: 'Georgia',
    countryCode: 'GE',
    timeZone: 'Asia/Tbilisi',
    coords: [41.7151, 44.8271],
    blurb:
      'Capital of Georgia, wrapped around the Mtkvari river between Narikala fortress and the Sameba cathedral.',
  },
  {
    id: 'gudauri',
    name: 'Gudauri',
    localName: 'გუდაური',
    country: 'Georgia',
    countryCode: 'GE',
    timeZone: 'Asia/Tbilisi',
    coords: [42.4772, 44.4783],
    blurb:
      'Ski resort on the southern slopes of the Greater Caucasus, on the Georgian Military Highway at ~2,200 m.',
  },
  {
    id: 'amsterdam',
    name: 'Amsterdam',
    localName: 'Amsterdam',
    country: 'Netherlands',
    countryCode: 'NL',
    timeZone: 'Europe/Amsterdam',
    coords: [52.3731, 4.8926],
    blurb:
      'Dutch capital built on concentric canals, with Dam Square and Centraal Station at its centre.',
  },
]

export const cityById = new Map(cities.map((c) => [c.id, c]))

/** 🇬🇪 from "GE" — regional indicator symbols are just letters offset into a block. */
export function flagEmoji(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .replace(/[A-Z]/g, (ch) => String.fromCodePoint(0x1f1e6 + ch.charCodeAt(0) - 65))
}
