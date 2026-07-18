# book-nest

Self-hosted book-library product: personal catalog, reading tracking, series, loans, deliveries, favorites, custom lists, and a what's-new feed. Fullstack TypeScript monorepo, built as a modular monolith so service extraction stays mechanical when a real boundary demands it.

> Loaded at the start of every Claude Code session. It overrides default behavior — follow it exactly.

---

## 1. Stack

- **Workspace**: pnpm workspaces (Node 24, pnpm 10) + Turborepo, shared TS config in `tsconfig.base.json`.
- **`apps/web`**: Next.js 16 (App Router, RSC/SSR) + React 19 + TS strict. next-intl locale routing (`/[locale]/`, `uk` default + `en`). TanStack Query v5 for client data (via Orval-generated hooks), Zustand for client UI state, RHF + Zod, shadcn/ui, Tailwind v4, next-themes. Vitest + RTL + happy-dom. Locale middleware in `src/proxy.ts`.
- **`apps/api`**: NestJS 11 + Prisma 7 (engineless, `@prisma/adapter-pg`) + PostgreSQL, TS strict (ESM). Feature-sliced layered modules (`api / application / domain / infrastructure`). nestjs-zod validation pipes, `@nestjs/swagger`, pino (JSON prod / pretty dev), helmet, compression, `@nestjs/throttler`, jose (JWT), bcryptjs, BullMQ + Redis (background jobs — `core/queue`, first use is async media thumbnails), OpenTelemetry + prom-client, graceful shutdown, request-id correlation, global `HttpErrorFilter`, Zod-validated env. Hot reload via `@swc-node/register --watch` (**not** `tsx` — it strips the decorator metadata Nest DI needs). Schema in `prisma/schema.prisma`, client generated to `src/generated/prisma`.
- **`packages/shared`**: Zod DTOs + API contracts, imported as `@app/shared`. Single source of truth for FE/BE types.

---

## 2. Frontend ↔ backend contract

- BE serves REST under `/api/*`. FE reaches it through Next.js `rewrites()` (`apps/web/next.config.ts`, proxy to `API_BASE_URL`, default `localhost:4000`).
- **Types are generated, not hand-written.** BE controllers wrap `@app/shared` Zod schemas with `createZodDto` → `@nestjs/swagger` emits OpenAPI (`pnpm --filter @app/api generate:openapi` → `openapi.json`) → Orval generates a typed TanStack-Query client + Zod into `apps/web/src/shared/api/generated/**` (`pnpm gen:api`). Consume the generated hooks; never hand-roll `fetch`/Zod against `@app/shared`.
- **Data fetching is client-side** (TanStack Query inside `"use client"` feature components). SSR/RSC renders only the shell, per-locale routing, and `generateMetadata` (SEO) — no server-side data prefetch/hydration. Auth is a client-held in-memory access token + client route guards; the refresh token is an httpOnly cookie.

---

## 3. Repo layout

```
apps/
  web/                 Next.js 16 (App Router)
    next.config.ts     rewrites() proxy /api/* → API_BASE_URL
    src/
      app/[locale]/    routed pages — (app)/(auth)/(legal) route groups, layouts, generateMetadata
      features/<name>/  api/ (generated-client wrappers + hooks) · components/ · hooks/ · model/ · index.ts barrel
      components/      shared UI; ui/ = vendored shadcn primitives (do not edit)
      shared/api/generated/  Orval output (client + zod + models) — generated, never hand-edit
      i18n/            next-intl routing + navigation
      messages/        uk.json, en.json
      lib/             env (Zod), http, formatting, auth bridge
      styles/globals.css  Tailwind v4 + semantic tokens (OKLCH)
      proxy.ts         next-intl locale middleware
  api/                 NestJS 11 + Prisma 7 (Postgres)
    prisma/schema.prisma   models — schema source of truth
    prisma/migrations/     reviewed SQL migrations
    prisma.config.ts       Prisma CLI config (loads .env)
    src/
      index.ts         bootstrap → listen → graceful shutdown
      bootstrap.ts     helmet, cors, cookies, swagger, global filter
      app.module.ts    root module — feature modules + DatabaseModule + middleware
      config/env.ts    Zod-validated env
      core/            database/ (PrismaService, @Global module, TransactionRunner) · pipes/ · exceptions/ · middleware/ · logger · tracing
      modules/<feature>/  api/ · application/ · domain/ · infrastructure/
      generated/prisma  generated client (gitignored)
      test/            createTestApp, truncate, global-setup
packages/
  shared/              @app/shared — Zod DTOs + API contracts (barrel src/index.ts)
```

---

## 4. Commands (from repo root)

| Command                             | Purpose                                             |
| ----------------------------------- | --------------------------------------------------- |
| `pnpm install`                      | Install all dependencies                            |
| `pnpm dev`                          | web (`:3000`) and api (`:4000`) in parallel         |
| `pnpm dev:web` / `pnpm dev:api`     | one side only                                       |
| `pnpm gen:api`                      | regenerate the typed API client from the BE OpenAPI |
| `pnpm typecheck`                    | TS strict across all packages                       |
| `pnpm build`                        | Build all packages                                  |
| `pnpm lint` / `pnpm lint:fix`       | ESLint (root config)                                |
| `pnpm format` / `pnpm format:check` | Prettier write / check                              |
| `pnpm test`                         | Vitest where tests exist                            |
| `pnpm knip`                         | dead code, unused exports, unused deps              |

Migrations: `pnpm --filter @app/api db:migrate --name <snake_case>` (create-only) then `pnpm --filter @app/api db:migrate:deploy` (apply) — see §6.

---

## 5. Backend architecture (non-negotiable)

Business logic stays independent of HTTP **and** of the data layer, so each layer is testable in isolation and service extraction stays mechanical. Canonical reference: [`.claude/agents/backend-engineer.md`](./.claude/agents/backend-engineer.md), [`docs/code-principles.md`](./docs/code-principles.md).

**Layers (feature-sliced module):**

1. **Controllers** (`modules/<feature>/api/`) — `@Controller("api/<feature>")`. Validate `@Body`/`@Query` via Zod pipes, call the service, return the value. No Prisma, no business logic. Swagger via `@Api*` + `createZodDto`.
2. **Services** (`application/`) — `@Injectable()` business logic. Typed in → typed out, throw `HttpError` subclasses (`core/exceptions/`), map Prisma model → ViewModel DTO, wrap multi-write flows in `TransactionRunner.run(...)`. Never inject `PrismaService`; know nothing about `req`/`res`.
3. **Repositories** (`infrastructure/`) — `@Injectable()`, inject `PrismaService`, the **only** layer that touches Prisma (besides `core/database`). Take an optional trailing `client: Prisma.TransactionClient = this.prisma` so a service-owned transaction threads through. Return model rows / primitives, never a ViewModel.
4. **Models** (`prisma/schema.prisma`) — snake_case columns via `@map`/`@@map`, explicit relations, UUID PKs. Changes go through reviewed `prisma migrate` SQL — never `db push` against shared data.
5. **DTOs** (`packages/shared`) — request/response Zod schemas + types, imported by both apps. `createZodDto` wraps them for Swagger.
6. **Env** — read once in `config/env.ts` via Zod, exported typed. Never `process.env.X` elsewhere (except `prisma.config.ts`).
7. **Errors** thrown in services extend `HttpError`; the global `HttpErrorFilter` maps them to JSON with `requestId`. ZodErrors auto-map to 400/422.
8. **Logging** — `createLogger("scope")` from `core/logger.ts`, never `console.log`. Request-id propagated by `RequestLoggerMiddleware`.
9. **Prefer pure-JS deps over native addons** (native modules break bare CI / serverless cold-start): `bcryptjs` not `bcrypt`, `jose` not `jsonwebtoken`. Prisma 7 is engineless for the same reason. Native addon only under a measured need.

---

## 6. Adding an endpoint

1. Zod request/response schema + types in `packages/shared`.
2. `model` in `apps/api/prisma/schema.prisma` (if a new entity).
3. **Migrations are the source of truth — two-step, never one-shot.** (a) `pnpm --filter @app/api db:migrate --name <snake_case>` creates a review-only migration (`migrate dev --create-only`; `--name` is required — bare `prisma migrate dev` blocks forever on the interactive name prompt in a non-TTY shell). (b) Review the `migration.sql` (delegate to `migration-reviewer`; watch the rename trap; strip the DROP-INDEX lines per the trap below), then `pnpm --filter @app/api db:migrate:deploy` (non-interactive, advisory-locked).
   - **Raw-SQL-index trap.** Four indexes live in hand-written SQL inside their migrations because Prisma can't express them in a `model`: trigram GIN `authors_search_text_trgm_idx` + `publishers_search_text_trgm_idx` (`gin_trgm_ops`, cross-locale search), and partial-unique `book_deliveries_active_book_idx` + `book_loans_active_book_idx` (one active delivery / one active loan per book). They exist in the DB but not in `schema.prisma`, so every generated migration emits a spurious `DROP INDEX` for them. Hand-strip those `DROP INDEX` lines **before** `db:migrate:deploy`, or search degrades to a seq scan and the one-active invariants are silently lost.
4. Repository — inject `PrismaService`, parameterized queries only.
5. Service — business logic, `HttpError` subclasses, map model → ViewModel, `TransactionRunner.run(...)` for multi-write.
6. Input DTO classes in `api/input-dto/` via `createZodDto(Schema)`.
7. Controller — `@Get/@Post`, Zod pipes, `@UseGuards` if auth, full `@Api*` Swagger.
8. Module (`<feature>.module.ts`) + wire into `app.module.ts`.
9. Tests (service unit + controller integration via `createTestApp`).
10. `pnpm gen:api`, then FE consumes the generated hooks.

---

## 7. Frontend conventions

- **Feature-sliced** `src/features/<name>/`: `api/` (wrappers around the generated client + hooks), `components/`, `hooks/`, `model/`, barrel `index.ts`.
- **Routing** is the App Router — server components under `src/app/[locale]/`, `generateMetadata` for SEO. Feature components that fetch data are `"use client"`.
- **Data**: TanStack Query via the Orval-generated client. Mock at the `fetch` boundary in tests, never mock RQ hooks.
- **Forms**: react-hook-form + zod + shadcn primitives **directly** — no wrapper `<Form>`/`<FormField>` abstractions.
- **State**: Zustand for client-only UI state; server state lives in TanStack Query.
- **Styling**: Tailwind v4, semantic tokens (`bg-background`, `text-foreground`, `text-primary`, `text-muted-foreground`) in `src/styles/globals.css` — not raw colors. Theme via `next-themes` (light/dark/system, OKLCH palette). Mobile-first responsive.
- **Shadcn primitives** in `src/components/ui/` are vendored — do not edit. `Button` and `DropdownMenuItem` already carry `cursor-pointer`; add it to custom click handlers.
- **Env**: read once in `src/lib/env.ts` via Zod, exported typed. Never read env vars directly elsewhere.

---

## 8. Non-negotiable rules

**Code style**

1. **No comments.** Self-documenting code; rename symbols until the code explains itself.
2. **No `any`, no `!`, minimal `as`.** Parse with Zod at boundaries, trust types inside. Prefer `Nullable<T>` / `ValueOf<T>` from `@app/shared` over hand-written `T | null` / `T[keyof T]`. Full canon: [`docs/typescript-principles.md`](./docs/typescript-principles.md).
3. **Zod at every boundary** — request bodies, env, localStorage, URL params, third-party responses. Never trust unparsed input.
4. **Never hardcode secrets.** Keys/tokens/PII live in env vars, validated by `config/env.ts` / `lib/env.ts`.
5. **No wrapper libraries over standard tools.** Use RHF + Zod + shadcn (and any established library) directly.
6. **Measure before optimizing.** No `useMemo`/`useCallback`/`React.memo`/virtualization/lazy-loading without measured evidence (react-scan / Profiler / web vitals) of a real problem on the critical path.
7. **DRY the knowledge, not the resemblance.** One source of truth for a business rule / type / contract, but leave incidental similarity alone (e.g. FE `lib/env.ts` vs BE `config/env.ts`). Extract on the third real use, not the second. Optimize for changeability: easy-to-delete > easy-to-extend. Full reference: [`docs/code-principles.md`](./docs/code-principles.md).
8. **Layered architecture is sacred.** BE: no Prisma in controllers, no Prisma outside repositories, no `req`/`res` in services, repositories never return a ViewModel. FE: no fetch in components — go through the feature's `api/`.
9. **Early return over nested if.** Discriminated unions over multiple optional booleans. Make invalid states unrepresentable.
10. **One concern per file**, one default export where applicable.

**Working style**

11. **Verify before claiming done.** No "should work" — run the gates, curl the endpoint, screenshot the UI. Every claim backed by an observation.
12. **Be honest about uncertainty.** Never guess library APIs — use Context7 / Read / Bash, or say "I don't know".
13. **Push back on bad ideas** once, with reasoning; comply if overruled.
14. **Context7 first for libraries.** Before writing code against Next.js, TanStack Query, Tailwind, shadcn, NestJS, Prisma, Zod, RHF, or any external library — fetch current docs; training data may predate breaking changes.
15. **No preemptive scaffolding.** Build roadmap features (OAuth, WebSockets, RabbitMQ, microservices, Docker, payments) when a real feature needs them; keep module boundaries clean instead.
16. **Investigate before destructive actions.** Before `rm`, `git reset --hard`, `git push --force`, dropping databases, or anything irreversible — confirm with the user.

---

## 9. Quality gates (all pass before "done")

```bash
pnpm typecheck     # TS strict, all packages
pnpm lint          # ESLint
pnpm format:check  # Prettier
pnpm test          # Vitest where tests exist
pnpm knip          # dead code / unused exports / unused deps
```

BE additionally: `pnpm dev:api` starts clean; `curl -i http://localhost:4000/api/health` → 200 with `x-request-id`; the affected endpoint responds as expected (capture the curl).
FE additionally: `pnpm dev:web` starts clean, no console errors; for UI changes, verify visually (screenshot / Storybook).

Never report done with a failing gate. If a gate fails for an unrelated reason (e.g. a pre-existing flake), say so explicitly.

---

## 10. Delegation (mandatory, automatic, silent)

Route work to the right subagent without narrating or asking. Agents live in `.claude/agents/` — full registry in [`.claude/agents/README.md`](./.claude/agents/README.md). A subagent does **not** see the conversation: pass a self-contained brief (what, where, constraints, what to return). Summarize its result briefly; don't paste the full report.

| Task                                                                 | Agent                                              |
| -------------------------------------------------------------------- | -------------------------------------------------- |
| Write/modify React in `apps/web/src/**`                              | `frontend-engineer`                                |
| Visual polish, motion, typography, color, responsive rhythm          | `design-engineer`                                  |
| Write/modify NestJS/Prisma in `apps/api/src/**`                      | `backend-engineer`                                 |
| Tests in `apps/web/src/**` / `apps/api/src/**`                       | `frontend-test-engineer` / `backend-test-engineer` |
| Refactor / dead code / cleanup                                       | `refactor-specialist`                              |
| End-to-end user-visible feature needing a "what's new" entry         | `changelog-writer`                                 |
| Browser-side bug (UI, console, layout, hydration, interaction)       | `frontend-bug-hunter`                              |
| Server-side bug (500, failing endpoint, Prisma/Postgres error, hang) | `backend-bug-hunter`                               |
| Prisma migration / schema change                                     | `migration-reviewer`                               |
| Release / promote dev→stage→prod, deploy, "залить в прод", "выкати"  | `release-manager`                                  |
| "ready to commit" / "сделай ревью" / "проверь перед commit"          | `code-reviewer` (+ auditors below)                 |
| Anything touching auth / API / forms / env / deps / secrets          | `security-reviewer`                                |
| FE slow / bundle bloat / re-render / web-vitals regression           | `frontend-performance-auditor`                     |
| Accessibility, keyboard nav, ARIA, contrast, focus                   | `accessibility-auditor`                            |
| SEO / SSR markup, metadata, hreflang, sitemap/robots, locale routing | `seo-auditor`                                      |

**Parallel review** — on "ready to commit" / "полный ревью", launch the relevant reviewers in one turn (multiple Agent calls): always `code-reviewer`; plus `frontend-performance-auditor` / `accessibility-auditor` if the diff touches UI, `seo-auditor` if it touches routing/metadata/next-intl, `security-reviewer` if it touches auth/API/forms/env/deps.

**Do it yourself** (no delegation): trivial answers; reading or explaining existing code; edits in `docs/`; root config (`turbo.json`, `eslint.config.mjs`, `next.config.ts`, `tsconfig.base.json`, `knip.json`); rewriting this file; or when the user says "сделай сам".

---

## 11. Operating notes

- **Local Postgres may be down.** The API tolerates a missing DB at startup (health shows `postgres: "down"`, app still serves). Tests and data endpoints need a local Postgres with the credentials in `apps/api/vitest.config.ts` / `.env` (`pnpm db:up` for the Docker Postgres).
- **Modular monolith.** Service extraction comes later, only when a real boundary demands it — the only preparation is keeping module boundaries clean.
- **Per-user memory** at `~/.claude/projects/-Users-macbookpro14-WebstormProjects-book-nest/memory/` is auto-loaded and captures evolved feedback across sessions — honor it.

---

## 12. Working with the AI assistant

- Respond in **Russian**; code, paths, commands, and output stay in English.
- Terse by default: short status, no narration of upcoming steps, no trailing recaps.
- **Explain the why deeply for backend and non-obvious decisions.** The maintainer is a senior frontend engineer deepening backend/infra expertise — when a NestJS/Prisma/Postgres/HTTP/git-infra concept or a non-obvious tradeoff comes up, teach the mental model and the reasoning, with FE analogies where they help. This is depth on **concepts**, not narration of routine mechanical steps (those stay terse).
- Delegation is automatic and silent (§10).
- Avoid: comments in code, unverified "should work" claims, chatter, asking permission for routine work, wrapper libraries over standard tools, premature optimization, hardcoded values that belong in env.
