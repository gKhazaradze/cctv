#!/bin/sh
# Generates the runtime config the page loads before the app bundle.
#
# Vite bakes env vars into the bundle at build time, so without this you would
# have to rebuild the image to change an API key. nginx:alpine runs every
# executable in /docker-entrypoint.d before starting nginx, so this lands well
# before the first request.
set -eu

CONFIG_PATH="${CITYWATCH_CONFIG_PATH:-/usr/share/nginx/html/config.js}"

# Escape backslashes and double quotes so a stray character cannot break out of
# the JS string literal below.
escape_js() {
  printf '%s' "${1:-}" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

WINDY_KEY="$(escape_js "${WINDY_API_KEY:-}")"

cat > "$CONFIG_PATH" <<EOF
window.__CITYWATCH_CONFIG__ = {
  WINDY_API_KEY: "${WINDY_KEY}"
};
EOF

if [ -n "${WINDY_API_KEY:-}" ]; then
  echo "citywatch: runtime config written (Windy key present)"
else
  echo "citywatch: runtime config written (no Windy key — Tbilisi tiles will ask for one)"
fi
