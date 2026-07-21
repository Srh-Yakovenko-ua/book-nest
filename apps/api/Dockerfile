FROM node:26-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /repo

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.9.6 prune @app/api --docker

FROM base AS installer
COPY --from=pruner /repo/out/json/ ./
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /repo/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM base AS builder
COPY --from=installer /repo/ ./
COPY --from=pruner /repo/out/full/ ./
COPY --from=pruner /repo/tsconfig.base.json ./tsconfig.base.json
RUN DATABASE_URL="postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder" pnpm --filter @app/api exec prisma generate
RUN pnpm dlx turbo@2.9.6 build --filter=@app/api

FROM base AS prod-deps
COPY --from=pruner /repo/out/json/ ./
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /repo/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs
COPY --from=prod-deps --chown=nestjs:nodejs /repo/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /repo/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder --chown=nestjs:nodejs /repo/packages/shared/dist ./packages/shared/dist
COPY --from=prod-deps --chown=nestjs:nodejs /repo/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=prod-deps --chown=nestjs:nodejs /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=nestjs:nodejs /repo/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=nestjs:nodejs /repo/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nestjs:nodejs /repo/apps/api/prisma ./apps/api/prisma
COPY --from=builder --chown=nestjs:nodejs /repo/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --chown=nestjs:nodejs apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh
RUN chmod +x ./apps/api/docker-entrypoint.sh
USER nestjs
WORKDIR /repo/apps/api
EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
