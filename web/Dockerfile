FROM node:24-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare pnpm@11.19.0 --activate

WORKDIR /app

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS build

COPY eslint.config.mjs next-env.d.ts next.config.ts postcss.config.mjs tsconfig.json vitest.config.ts ./
COPY public ./public
COPY scripts ./scripts
COPY src ./src
COPY healthcheck.mjs ./healthcheck.mjs
RUN pnpm lint && pnpm typecheck && pnpm test --run && pnpm build

FROM base AS app

RUN groupadd --system --gid 1001 nextjs \
    && useradd --system --uid 1001 --gid nextjs nextjs \
    && install --directory --owner=nextjs --group=nextjs /data

WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=build --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nextjs /app/public ./public
COPY --from=build --chown=nextjs:nextjs /app/node_modules/.pnpm/better-sqlite3@13.0.3/node_modules/better-sqlite3/prebuilds/linux-x64.node ./node_modules/.pnpm/better-sqlite3@13.0.3/node_modules/better-sqlite3/prebuilds/linux-x64.node
COPY --from=build --chown=nextjs:nextjs /app/healthcheck.mjs ./healthcheck.mjs

VOLUME ["/data"]
USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]

FROM base AS maintenance

RUN apt-get update \
    && apt-get install --yes --no-install-recommends sqlite3 \
    && rm --recursive --force /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 nextjs \
    && useradd --system --uid 1001 --gid nextjs nextjs \
    && install --directory --owner=nextjs --group=nextjs /data /backups

WORKDIR /app
COPY --from=dependencies --chown=nextjs:nextjs /app/node_modules ./node_modules
COPY --chown=nextjs:nextjs package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=nextjs:nextjs next.config.ts tsconfig.json ./
COPY --chown=nextjs:nextjs scripts ./scripts
COPY --chown=nextjs:nextjs src ./src

VOLUME ["/data", "/backups"]
USER nextjs

CMD ["pnpm", "reconcile:github"]
