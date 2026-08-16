# Stage 1: Build the Next.js application
FROM node:24-alpine AS build
WORKDIR /app
ARG APP_VERSION=dev

RUN apk add --no-cache python3 make g++

COPY src/web/package.json src/web/package-lock.json ./
RUN npm ci

COPY src/web/ .
ENV NEXT_PUBLIC_APP_VERSION=${APP_VERSION}
RUN npm run build && npm run build:migrate

# Stage 2: Runtime
FROM node:24-alpine
WORKDIR /app

RUN apk add --no-cache wget

# Run as the unprivileged `node` user (uid 1000, ships with node:24-alpine)
# rather than root. Ownership is set with COPY --chown at copy time (not a
# later `chown -R`, which would copy-up every file into a new layer and
# roughly double the image size). /data must be created and owned by `node`
# before anything is mounted, because Docker seeds a fresh named volume's
# ownership from the image directory it first mounts over — get this wrong
# once and every volume created against this image is stuck root-owned,
# requiring a manual chown for every user who hits it.
COPY --chown=node:node --from=build /app/.next/standalone ./
COPY --chown=node:node --from=build /app/.next/static ./.next/static
COPY --chown=node:node --from=build /app/public ./public
COPY --chown=node:node --from=build /app/src/db/migrations ./src/db/migrations
COPY --chown=node:node --from=build /app/dist/migrate.js ./scripts/migrate.js
COPY --chown=node:node --from=build /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --chown=node:node src/web/scripts/start.sh ./start.sh
RUN chmod +x ./start.sh && mkdir -p /data && chown node:node /data

ENV NODE_ENV=production
ENV DB_PATH=/data/clearfolio.db
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000
VOLUME /data

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3000/api/health || exit 1

USER node
ENTRYPOINT ["./start.sh"]
