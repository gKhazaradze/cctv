import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * `index.html` always loads `/config.js`, which the Docker image generates from
 * its environment at start-up. There is no such file in a dev tree, so serve an
 * empty one rather than letting the page 404 on every reload. Dev picks its
 * config up from `.env.local` through `import.meta.env` instead.
 */
function runtimeConfigDevPlugin(): Plugin {
  return {
    name: 'citywatch-runtime-config',
    configureServer(server) {
      server.middlewares.use('/config.js', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.end('window.__CITYWATCH_CONFIG__ = {};\n')
      })
    },
  }
}

/**
 * Optional dev-only stream proxy.
 *
 * Some camera operators publish an open HLS manifest but never set the CORS
 * headers a browser needs, which makes the stream unplayable from a web page
 * even though the URL itself is public. Setting STREAM_PROXY_ORIGIN turns on a
 * pass-through at /stream-proxy for exactly those cases.
 *
 * Only point this at streams whose operator permits third-party playback. It is
 * deliberately opt-in, single-origin and dev-only: it is not a tool for getting
 * around an operator that is actively refusing cross-origin requests.
 */
export default defineConfig(() => {
  const proxyOrigin = process.env.STREAM_PROXY_ORIGIN

  return {
    plugins: [react(), runtimeConfigDevPlugin()],
    server: {
      port: 5173,
      // Bind on all interfaces so the dev container is reachable from the host.
      host: true,
      proxy: proxyOrigin
        ? {
            '/stream-proxy': {
              target: proxyOrigin,
              changeOrigin: true,
              secure: true,
              rewrite: (path: string) => path.replace(/^\/stream-proxy/, ''),
            },
          }
        : undefined,
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      // hls.js is ~525 kB and is deliberately split into its own lazy chunk —
      // it is only fetched when an `hls` camera actually plays. Raising the
      // limit keeps the warning meaningful for chunks we did not intend.
      chunkSizeWarningLimit: 600,
    },
  }
})
