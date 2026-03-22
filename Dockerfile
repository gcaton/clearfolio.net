# Stage 1: Build Angular
FROM node:24-alpine AS frontend-build
WORKDIR /app
ARG APP_VERSION=dev

COPY src/app/package.json src/app/package-lock.json ./
RUN npm ci

COPY src/app/ .
RUN sed -i "s/version: 'dev'/version: '${APP_VERSION}'/" src/environments/environment.ts
RUN npx ng build --configuration production

# Stage 2: Build .NET API
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api-build
WORKDIR /src

COPY src/api/Clearfolio.Api/Clearfolio.Api.csproj Clearfolio.Api/
RUN dotnet restore Clearfolio.Api/Clearfolio.Api.csproj

COPY src/api/ .
RUN dotnet publish Clearfolio.Api/Clearfolio.Api.csproj -c Release -o /app/publish

# Stage 3: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine

RUN apk add --no-cache nginx

COPY --from=frontend-build /app/dist/app/browser /usr/share/nginx/html
COPY src/app/nginx.conf /etc/nginx/http.d/default.conf

WORKDIR /app
COPY --from=api-build /app/publish .

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV DB_PATH=/data/clearfolio.db
ENV ASPNETCORE_URLS=http://+:8080

EXPOSE 80
VOLUME /data

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost/api/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
