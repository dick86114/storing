FROM node:20-alpine AS base

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/mcp/package.json ./apps/mcp/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile

FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/apps/mcp/node_modules ./apps/mcp/node_modules
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

RUN apk add --no-cache \
      ca-certificates \
      chromium \
      freetype \
      harfbuzz \
      nss \
      ttf-freefont && \
    npm install -g single-file-cli@latest && \
    npm cache clean --force

COPY --from=builder --chown=storing:nodejs /app/packages/shared/src ./packages/shared/src
COPY --from=builder --chown=storing:nodejs /app/packages/shared/package.json ./packages/shared/

COPY --from=builder --chown=storing:nodejs /app/apps/api/src ./apps/api/src
COPY --from=builder --chown=storing:nodejs /app/apps/api/package.json ./apps/api/
COPY --from=builder --chown=storing:nodejs /app/apps/api/node_modules ./apps/api/node_modules

COPY --from=builder --chown=storing:nodejs /app/apps/mcp/src ./apps/mcp/src
COPY --from=builder --chown=storing:nodejs /app/apps/mcp/package.json ./apps/mcp/
COPY --from=builder --chown=storing:nodejs /app/apps/mcp/node_modules ./apps/mcp/node_modules

COPY --from=builder --chown=storing:nodejs /app/apps/web/public ./apps/web/.next/standalone/apps/web/public
COPY --from=builder --chown=storing:nodejs /app/apps/web/.next/standalone ./apps/web/.next/standalone
COPY --from=builder --chown=storing:nodejs /app/apps/web/.next/static ./apps/web/.next/standalone/apps/web/.next/static

COPY --from=builder --chown=storing:nodejs /app/package.json ./package.json
COPY --from=builder --chown=storing:nodejs /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder --chown=storing:nodejs /app/node_modules ./node_modules

RUN printf '%s\n' \
    '#!/bin/sh' \
    'set -u' \
    '' \
    'stop_children() {' \
    '  kill "${api_pid:-}" "${mcp_pid:-}" "${web_pid:-}" 2>/dev/null || true' \
    '  wait "${api_pid:-}" "${mcp_pid:-}" "${web_pid:-}" 2>/dev/null || true' \
    '}' \
    '' \
    'trap stop_children INT TERM' \
    '' \
    '(cd /app/apps/api && node --import tsx src/index.ts) &' \
    'api_pid=$!' \
    '(cd /app/apps/mcp && node --import tsx src/http.ts) &' \
    'mcp_pid=$!' \
    '(cd /app/apps/web/.next/standalone/apps/web && node server.js) &' \
    'web_pid=$!' \
    '' \
    'while true; do' \
    '  if ! kill -0 "$api_pid" 2>/dev/null; then' \
    '    status=0' \
    '    wait "$api_pid" || status=$?' \
    '    echo "API process exited with status $status; stopping container"' \
    '    stop_children' \
    '    exit "$status"' \
    '  fi' \
    '' \
    '  if ! kill -0 "$mcp_pid" 2>/dev/null; then' \
    '    status=0' \
    '    wait "$mcp_pid" || status=$?' \
    '    echo "MCP HTTP process exited with status $status; stopping container"' \
    '    stop_children' \
    '    exit "$status"' \
    '  fi' \
    '' \
    '  if ! kill -0 "$web_pid" 2>/dev/null; then' \
    '    status=0' \
    '    wait "$web_pid" || status=$?' \
    '    echo "Web process exited with status $status; stopping container"' \
    '    stop_children' \
    '    exit "$status"' \
    '  fi' \
    '' \
    '  sleep 2' \
    'done' \
    > /app/start.sh && \
    chmod +x /app/start.sh

USER storing

EXPOSE 1050 1052 1053

ENV PORT=1050
ENV API_PORT=1052
ENV MCP_HTTP_PORT=1053

CMD ["/app/start.sh"]
