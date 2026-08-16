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

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/src/db/migrations ./src/db/migrations
COPY --from=build /app/dist/migrate.js ./scripts/migrate.js
COPY --from=build /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY src/web/scripts/start.sh ./start.sh
RUN chmod +x ./start.sh

ENV NODE_ENV=production
ENV DB_PATH=/data/clearfolio.db
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000
VOLUME /data

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3000/api/health || exit 1

ENTRYPOINT ["./start.sh"]
