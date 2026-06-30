# book-nest

A teaching fullstack monorepo. A frontend developer learning backend by building a book app from end to end.

## Stack

pnpm workspaces with Turborepo. Node 24, pnpm 10.

- `apps/web`: Next.js 16 (App Router, SSR) with React 19 and TypeScript. next-intl locale routing (ru, en, uk), TanStack Query, Tailwind v4, shadcn/ui.
- `apps/api`: NestJS 11 with Prisma 7 and PostgreSQL. Feature-sliced layered modules (api, application, domain, infrastructure).
- `packages/shared`: request and response types shared by both apps, imported as `@app/shared`.

## Local development

You need Docker Desktop running (for the local Postgres) plus Node 24 and pnpm 10.

```
pnpm install
pnpm db:up      # start the local Postgres in Docker
pnpm dev        # run web on :3000 and api on :4000
```

Optional local services:

```
pnpm mail:up      # Mailpit, a local email inbox on :8025
pnpm storage:up   # MinIO, local S3-compatible storage (console on :9101)
pnpm dev:up       # bring up all local services at once
```

## Deploy

Self-hosted on a single Hetzner server with Docker Compose: Caddy for TLS and routing, plus web, api, and a self-hosted Postgres per environment. Images are built in GitHub Actions and pushed to GHCR, then the server pulls and runs them.

- Push to the `dev` branch deploys `dev.book-nest.net`.
- Push to the `prod` branch deploys `book-nest.net`.

See [`deploy/README.md`](./deploy/README.md) for the server setup and operations.

## Commands

Run from the repo root.

| Command          | What it does                                           |
| ---------------- | ------------------------------------------------------ |
| `pnpm dev`       | web and api in parallel                                |
| `pnpm typecheck` | TypeScript across all packages                         |
| `pnpm lint`      | ESLint                                                 |
| `pnpm format`    | Prettier write                                         |
| `pnpm test`      | Vitest                                                 |
| `pnpm knip`      | dead code and unused dependencies                      |
| `pnpm gen:api`   | generate the typed API client from the backend OpenAPI |

Server and database helpers over SSH: `pnpm server:ps`, `pnpm server:stats`, `pnpm server:logs`, `pnpm server:health`, `pnpm db:size`, `pnpm db:copy:dev`.

## More docs

- [`CLAUDE.md`](./CLAUDE.md): architecture, conventions, and the full command reference.
- [`docs/`](./docs/): code principles, patterns, and per-tool notes.
- [`deploy/README.md`](./deploy/README.md): deployment and server operations.
