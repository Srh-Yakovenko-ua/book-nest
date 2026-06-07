# book-nest

A teaching fullstack monorepo — a clean skeleton for building a book-centric app end-to-end.

pnpm-workspace monorepo: React + Vite (`apps/web`), NestJS + TypeORM + PostgreSQL (`apps/api`), shared DTOs (`packages/shared`).

The skeleton ships only infrastructure — env config, logger, error handling, layered architecture, DB wiring, health + metrics endpoints on the backend, and the FE shell with routing, theming, i18n, and a TanStack Query setup. No domain features yet; that's what you build.

See [`CLAUDE.md`](./CLAUDE.md) for architecture, conventions, and commands.
