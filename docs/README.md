# Documentation

Project documentation for `book-nest`.

## Overview

- [Architecture](./architecture.md) — folder structure, feature-sliced design, decision table
- [Stack](./stack.md) — full dependency list grouped by purpose
- [Workflow](./workflow.md) — daily commands, quality gates, env variables
- [Patterns](./patterns.md) — how to add a feature, write forms, fetch data, log, style
- [Code principles](./code-principles.md) — how to write code: naming, decomposition, types, anti-patterns
- [Backend roadmap](./backend-roadmap.md) — what the backend still lacks for production, verified per item, with a suggested order
- [Feature map](./features/README.md) — end-to-end docs per feature (FE ↔ shared ↔ BE), maintained by `feature-context-curator`

## Tools

One file per tool — "what is this, why do we have it, how to use it".

### Monorepo & build

- [pnpm workspaces & catalogs](./tools/monorepo.md)
- [Turborepo](./tools/turborepo.md)
- [TypeScript](./tools/typescript.md)

### Code quality

- [ESLint](./tools/eslint.md)
- [Prettier](./tools/prettier.md)
- [knip](./tools/knip.md)
- [Husky + lint-staged + commitlint](./tools/husky-commitlint.md)

### Testing

- [Vitest + React Testing Library](./tools/vitest.md)

### Frontend UI

- [Tailwind CSS v4](./tools/tailwind.md)
- [shadcn/ui](./tools/shadcn.md)

### Claude Code integration

- [MCP servers (Playwright, Context7, frontend-design)](./tools/mcp-servers.md)

## Per-package READMEs

- [`apps/web`](../apps/web/README.md): Next.js frontend package
- `apps/api`: NestJS + Prisma + Postgres backend package
- `packages/shared`: shared types between frontend and backend
