/**
 * Configuration the container can supply at start-up.
 *
 * Vite bakes `import.meta.env` values into the bundle at build time, which is
 * awkward for a long-running container: adding an API key would mean rebuilding
 * the image. The runtime image instead writes a tiny `/config.js` from its
 * environment before nginx starts, and that is read here first.
 *
 * Order of precedence: runtime `/config.js` → build-time `.env` → undefined.
 */

export interface RuntimeConfig {
  WINDY_API_KEY?: string
}

declare global {
  interface Window {
    __CITYWATCH_CONFIG__?: RuntimeConfig
  }
}

function readRuntime(key: keyof RuntimeConfig): string | undefined {
  if (typeof window === 'undefined') return undefined
  const value = window.__CITYWATCH_CONFIG__?.[key]
  // The entrypoint writes an empty string when the variable is unset.
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function readBuildTime(key: string): string | undefined {
  const value = import.meta.env?.[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

export function configValue(
  runtimeKey: keyof RuntimeConfig,
  buildTimeKey: string,
): string | undefined {
  return readRuntime(runtimeKey) ?? readBuildTime(buildTimeKey)
}
