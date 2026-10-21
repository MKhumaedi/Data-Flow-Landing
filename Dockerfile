# MayStudio API — works on Cloud Run, Railway, Render, Fly.io, any Docker host.
# Build context = this folder (api/):  docker build -t maystudio-api .

FROM node:22-slim AS base
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- build: install all deps, generate Prisma client, compile TypeScript ----
FROM base AS build
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY tsconfig.json tsconfig.build.json server.ts ./
COPY src ./src
RUN npx prisma generate && npx tsc -p tsconfig.build.json

# ---- runtime: production deps only ----
FROM base AS runtime
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev --ignore-scripts
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY assets ./assets
COPY public ./public

# Platforms inject PORT (Cloud Run: 8080). The app reads it from the environment.
ENV PORT=3000
EXPOSE 3000
CMD ["node", "dist/server.js"]
