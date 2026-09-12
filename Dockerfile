# syntax=docker/dockerfile:1.7
#
# Node/Docker image for the Wopla AI web app (self-hosted deployment).
#
# NOTE: VITE_* values are inlined into the client bundle at BUILD time, so the
# image is environment-specific. Pass them as build args, and rebuild to point
# at a different Supabase. They are public values by design (the anon key is
# meant to ship to browsers), so baking them is safe.
#
#   docker build \
#     --build-arg VITE_SUPABASE_URL=https://api.example.com \
#     --build-arg VITE_SUPABASE_ANON_KEY=... \
#     --build-arg VITE_APP_URL=https://app.example.com \
#     -t wopla-ai-web:latest .

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable

# ---------------------------------------------------------------- dependencies
FROM base AS deps
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# --------------------------------------------------------------------- build
FROM base AS build
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /repo/packages/shared/node_modules ./packages/shared/node_modules
COPY . .

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_APP_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_APP_URL=$VITE_APP_URL

RUN test -n "$VITE_SUPABASE_URL"  || (echo "VITE_SUPABASE_URL build arg is required" && exit 1)
RUN test -n "$VITE_SUPABASE_ANON_KEY" || (echo "VITE_SUPABASE_ANON_KEY build arg is required" && exit 1)

RUN pnpm --filter @wopla-ai/web run build

# Self-contained production tree (flattens the workspace link to @wopla-ai/shared).
RUN pnpm deploy --legacy --filter=@wopla-ai/web --prod /out \
 && cp -r apps/web/dist /out/dist

# -------------------------------------------------------------------- runtime
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

COPY --from=build /out/package.json ./package.json
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/server ./server
COPY --from=build /out/dist ./dist

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/node-server.mjs"]
