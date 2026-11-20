# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npx prisma generate && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV PDF_BROWSER_PATH=/usr/bin/chromium-browser
RUN apk add --no-cache openssl libc6-compat wget chromium nss freetype harfbuzz ttf-freefont udev ca-certificates
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY assets ./assets
RUN npm ci && npx prisma generate
COPY --from=build /app/dist ./dist
COPY docker/entrypoint.sh /entrypoint.sh
COPY docker/migrate-deploy-safe.sh /migrate-deploy-safe.sh
RUN chmod +x /entrypoint.sh /migrate-deploy-safe.sh
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health/live || exit 1
ENTRYPOINT ["/entrypoint.sh"]
