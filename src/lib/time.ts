import { useEffect, useState } from 'react'

/** Wall-clock time in a city's own zone, e.g. "14:07". */
export function formatLocalTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(date)
}

/** "Mon 10 Aug" in the city's own zone. */
export function formatLocalDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone,
  }).format(date)
}

/** Offset from the viewer's own clock, e.g. "+2h" — omitted when identical. */
export function offsetFromViewer(date: Date, timeZone: string): string | null {
  const inZone = (tz: string) =>
    new Date(date.toLocaleString('en-US', { timeZone: tz })).getTime()

  const local = inZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
  const there = inZone(timeZone)
  const diffHours = Math.round((there - local) / 3_600_000)

  if (diffHours === 0) return null
  return `${diffHours > 0 ? '+' : ''}${diffHours}h`
}

/** A Date that re-renders the component on a fixed cadence. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])

  return now
}
