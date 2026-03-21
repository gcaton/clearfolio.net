FROM node:24-alpine AS build
WORKDIR /app
ARG APP_VERSION=dev

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN sed -i "s/version: 'dev'/version: '${APP_VERSION}'/" src/environments/environment.ts
RUN npx ng build --configuration production

FROM nginx:alpine
COPY --from=build /app/dist/app/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
