FROM node:24.14.1-bookworm-slim@sha256:b506e7321f176aae77317f99d67a24b272c1f09f1d10f1761f2773447d8da26c AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1
ENV COREPACK_HOME="/corepack"

RUN corepack enable \
    && corepack prepare pnpm@11.19.0 --activate \
    && chown --recursive 1001:1001 "$COREPACK_HOME"

WORKDIR /app

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS build

COPY eslint.config.mjs next.config.ts postcss.config.mjs tsconfig.json vitest.config.ts ./
COPY public ./public
COPY scripts ./scripts
COPY e2e ./e2e
COPY src ./src
COPY healthcheck.mjs ./healthcheck.mjs
RUN pnpm lint && pnpm typecheck && pnpm build

FROM base AS app

RUN groupadd --system --gid 1001 nextjs \
    && useradd --system --uid 1001 --gid nextjs nextjs

WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=build --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nextjs /app/public ./public
COPY --from=build --chown=nextjs:nextjs /app/healthcheck.mjs ./healthcheck.mjs

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]

FROM base AS maintenance

RUN groupadd --system --gid 1001 nextjs \
    && useradd --system --uid 1001 --gid nextjs nextjs

WORKDIR /app
ENV NODE_ENV=production
COPY --from=dependencies --chown=nextjs:nextjs /app/node_modules ./node_modules
COPY --chown=nextjs:nextjs package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=nextjs:nextjs next.config.ts tsconfig.json ./
COPY --chown=nextjs:nextjs scripts ./scripts
COPY --chown=nextjs:nextjs src ./src

USER nextjs

CMD ["pnpm", "reconcile:github"]
