FROM node:20-alpine AS base

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile

FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_OUTPUT_STANDALONE=true
RUN cd apps/web && pnpm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 storing

COPY --from=builder --chown=storing:nodejs /app/packages/shared/src ./packages/shared/src
COPY --from=builder --chown=storing:nodejs /app/packages/shared/package.json ./packages/shared/

COPY --from=builder --chown=storing:nodejs /app/apps/api/src ./apps/api/src
COPY --from=builder --chown=storing:nodejs /app/apps/api/package.json ./apps/api/
COPY --from=builder --chown=storing:nodejs /app/apps/api/node_modules ./apps/api/node_modules

COPY --from=builder --chown=storing:nodejs /app/apps/web/public ./apps/web/.next/standalone/apps/web/public
COPY --from=builder --chown=storing:nodejs /app/apps/web/.next/standalone ./apps/web/.next/standalone
COPY --from=builder --chown=storing:nodejs /app/apps/web/.next/static ./apps/web/.next/standalone/apps/web/.next/static

COPY --from=builder --chown=storing:nodejs /app/package.json ./package.json
COPY --from=builder --chown=storing:nodejs /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder --chown=storing:nodejs /app/node_modules ./node_modules

RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'cd /app/apps/api && node --import tsx src/index.ts &' >> /app/start.sh && \
    echo 'cd /app/apps/web/.next/standalone/apps/web && node server.js &' >> /app/start.sh && \
    echo 'wait' >> /app/start.sh && \
    chmod +x /app/start.sh

USER storing

EXPOSE 1050 1052

ENV PORT=1050
ENV API_PORT=1052

CMD ["/app/start.sh"]
