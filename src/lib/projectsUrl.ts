/**
 * Where the "Back to My Projects" link points.
 *
 * CityWatch is a subdomain of the projects hub (`citywatch.georgelands.com`),
 * whose homepage lives on the apex. Strip the leading label to get there,
 * keeping protocol and port. Overridable via `window.PROJECTS_URL`; falls back
 * to "/" when there is no subdomain to strip.
 *
 * Kept byte-for-byte in step with the same helper in the platform's other apps
 * (flight_tracker, roadtrip-site, availability_calendar).
 */

declare global {
  interface Window {
    PROJECTS_URL?: string
  }
}

export function projectsUrl(): string {
  if (typeof window === 'undefined') return '/'
  if (window.PROJECTS_URL) return window.PROJECTS_URL

  const { protocol, hostname, port } = window.location
  const host = hostname.replace(/\.$/, '') // drop any FQDN trailing dot
  const portSuffix = port ? ':' + port : ''
  const labels = host.split('.')

  // Local platform dev mirrors prod under a `.localhost` TLD: the hub is
  // `localhost` and each app is `<app>.localhost`. Strip to reach the hub.
  if (labels.length > 1 && labels[labels.length - 1] === 'localhost') {
    return `${protocol}//localhost${portSuffix}`
  }

  // Nothing to strip on IPs (v4/v6), bare localhost, apex domains, or a www host.
  const isIp =
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':') || host.startsWith('[')
  if (isIp || labels.length < 3 || labels[0] === 'www') return '/'

  const apex = labels.slice(1).join('.')
  return `${protocol}//${apex}${portSuffix}`
}
