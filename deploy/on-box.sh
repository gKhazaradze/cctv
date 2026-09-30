#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────
# The deploy, as it runs ON THE BOX. The gate (my_home_page/deploy/box) has
# already fetched origin, checked this is the commit CI tested, reset the
# checkout to it and cd-ed here; this runs as root with a clean environment
# (APP=citywatch, DEPLOY_SHA=<commit>). CI can trigger it but not change it:
# what runs is this file, as committed on the branch (security fix plan 5.4).
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

# The CI job pipes "<github actor> <GITHUB_TOKEN>" to the gate; the token
# only lives as long as that job, and is logged out of again below.
read -r GHCR_USER GHCR_TOKEN || { echo "no registry credentials on stdin" >&2; exit 1; }

echo "--- Ensuring this app's edge network exists ---"
# Our compose joins `edge-citywatch`, shared only with the platform's Caddy
# (security fix plan 5.2). Create it if missing and make sure Caddy is
# on it, so a first deploy never depends on the platform's own order.
docker network inspect edge-citywatch >/dev/null 2>&1 || docker network create edge-citywatch
docker network connect edge-citywatch caddy 2>/dev/null || true

echo "--- Pulling the prebuilt image ---"
# GHCR packages default to private even for a public repo, so
# authenticate with this run's token, then drop it again.
printf "%s\n" "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin

cd /srv/citywatch
docker compose pull app

echo "--- Starting the container ---"
# --no-build is load-bearing: it makes it structurally impossible
# for this box to attempt a Rollup build, whatever the compose file
# says. See the note at the top of this workflow.
docker compose up -d --no-build app

docker logout ghcr.io >/dev/null 2>&1 || true

echo "--- Pruning dangling images (keep disk in check) ---"
# Each deploy leaves the previous image untagged; unpruned they fill
# the small root volume.
docker image prune -f >/dev/null 2>&1 || true

echo "--- Waiting for nginx to answer (inside the container) ---"
# citywatch publishes no host port (Caddy owns the edge), so probe
# the app directly inside the container instead of host :80.
for i in $(seq 1 15); do
  if docker exec citywatch wget -q --spider http://127.0.0.1/ 2>/dev/null; then
    echo "App is healthy"; exit 0
  fi
  sleep 2
done
echo "App failed to come up in time"
docker compose logs --tail=40
exit 1
