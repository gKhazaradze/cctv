# ---------------------------------------------------------------- base ------
# Dependencies + source. Shared by the build, dev and tooling stages so npm ci
# runs once and stays cached until the lockfile actually changes.
FROM node:26-alpine AS base
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# ----------------------------------------------------------------- build ----
FROM base AS build
RUN npm run build

# ------------------------------------------------------------------- dev ----
# Hot-reloading dev server. Compose bind-mounts the source over /app, so this
# stage mainly exists to provide a linux-native node_modules.
FROM base AS dev
ENV NODE_ENV=development
EXPOSE 5173
CMD ["npm", "run", "dev"]

# --------------------------------------------------------------- runtime ----
FROM nginx:1.27-alpine AS runtime

# Writes /config.js from the environment before nginx starts, so an API key can
# be added by restarting the container rather than rebuilding the image.
COPY docker/40-citywatch-config.sh /docker-entrypoint.d/40-citywatch-config.sh
RUN chmod +x /docker-entrypoint.d/40-citywatch-config.sh

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1

# nginx:alpine's own entrypoint runs /docker-entrypoint.d/* then execs this.
CMD ["nginx", "-g", "daemon off;"]
