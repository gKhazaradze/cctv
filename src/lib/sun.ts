const RAD = Math.PI / 180

/** Unix-epoch days between 1970-01-01T00:00Z and J2000.0 (2000-01-01T12:00 TT). */
const J2000_OFFSET_DAYS = 10957.5

/**
 * Approximate solar altitude in degrees for a point on Earth at a given moment.
 *
 * Low-precision NOAA formulation — good to roughly a tenth of a degree, which is
 * far more than enough to decide whether a camera is looking at daylight, dusk
 * or full dark. That matters here: a "night" badge is the difference between a
 * viewer thinking a feed is broken and understanding it is simply 3am there.
 */
export function sunAltitudeDeg(date: Date, latDeg: number, lonDeg: number): number {
  const d = date.getTime() / 86_400_000 - J2000_OFFSET_DAYS

  const meanAnomaly = (357.529 + 0.98560028 * d) * RAD
  const meanLongitude = 280.459 + 0.98564736 * d
  const eclipticLongitude =
    (meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly)) * RAD
  const obliquity = (23.439 - 0.00000036 * d) * RAD

  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude))
  const rightAscension = Math.atan2(
    Math.cos(obliquity) * Math.sin(eclipticLongitude),
    Math.cos(eclipticLongitude),
  )

  // Greenwich mean sidereal time, in hours, wrapped to [0, 24).
  const gmstHours = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24
  const localSiderealTime = (gmstHours * 15 + lonDeg) * RAD
  const hourAngle = localSiderealTime - rightAscension

  const lat = latDeg * RAD
  const altitude = Math.asin(
    Math.sin(lat) * Math.sin(declination) +
      Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle),
  )
  return altitude / RAD
}

export type DaylightPhase = 'day' | 'golden' | 'twilight' | 'night'

export function daylightPhase(date: Date, latDeg: number, lonDeg: number): DaylightPhase {
  const alt = sunAltitudeDeg(date, latDeg, lonDeg)
  if (alt > 6) return 'day'
  // -0.833° accounts for refraction and the sun's radius: the standard horizon.
  if (alt > -0.833) return 'golden'
  if (alt > -6) return 'twilight'
  return 'night'
}

export const phaseLabel: Record<DaylightPhase, string> = {
  day: 'Daylight',
  golden: 'Golden hour',
  twilight: 'Twilight',
  night: 'Night',
}

export const phaseIcon: Record<DaylightPhase, string> = {
  day: '☀',
  golden: '◐',
  twilight: '◑',
  night: '☾',
}
