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
3. **Migrations are the source of truth, two-step, never one-shot.** (a) `pnpm --filter @app/api db:migrate --name <snake_case>` creates a review-only migration. (b) Review the `migration.sql` (`migration-reviewer`, the rename trap, the raw-SQL-index strip-trap), then `pnpm --filter @app/api db:migrate:deploy`. The strip-trap and its sixteen indexes live in `.claude/rules/prisma-migrations.md`, which loads by itself as soon as you open anything under `apps/api/prisma/`; read it before deploying any generated migration.

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
10. **One concern per file**, one default export where applicable. **Group related constants into one cohesive object** (grouped by concept — not a junk-drawer), never a scatter of top-level `const`s / exports; extending it adds a key, not an import. See [`docs/code-principles.md`](./docs/code-principles.md) §3.10.
11. **Every date operation goes through `date-fns`** — in all three packages, `apps/api`, `apps/web` and `packages/shared` (which depends on it for exactly this reason). Compare with `isAfter` / `isBefore` / `compareAsc`, add and subtract with `addDays` / `subYears` / `milliseconds({ days })`, snap with `startOfYear` / `startOfDay`, validate with `isValid`. **Banned**: `getTime()` arithmetic or comparison, hand-rolled millisecond literals like `24 * 60 * 60 * 1000`, `new Date(y, m, d)` used as arithmetic, and in-place mutators (`setFullYear`, `setUTCHours`, `setDate`) — a mutated `Date` is a bug waiting for its second reader. Bare `new Date()` is allowed only to capture "now". Reach for `date-fns-tz` (`formatInTimeZone`) whenever a user's timezone is involved. When you touch a file, fix the date math you find next to your change rather than stepping around it.

**Working style**

11. **Verify before claiming done.** No "should work" — run the gates, curl the endpoint, screenshot the UI. Every claim backed by an observation.
12. **Be honest about uncertainty.** Never guess library APIs — use Context7 / Read / Bash, or say "I don't know".
13. **Push back on bad ideas** once, with reasoning; comply if overruled.
14. **Context7 first for libraries.** Before writing code against Next.js, TanStack Query, Tailwind, shadcn, NestJS, Prisma, Zod, RHF, or any external library — fetch current docs; training data may predate breaking changes.
15. **No preemptive scaffolding.** Build roadmap features (OAuth, WebSockets, RabbitMQ, microservices, Docker, payments) when a real feature needs them; keep module boundaries clean instead.
16. **Investigate before destructive actions.** Before `rm`, `git reset --hard`, `git push --force`, dropping databases, or anything irreversible — confirm with the user.

---

## 9. Quality gates

**Tests are written locally and run only in CI.** Every change still gets its tests; this machine just never runs them. An API vitest run boots Nest apps against Postgres, Redis and Mailpit and saturates the 24 GB machine, while `ci.yml` runs the whole suite sharded on every PR into `dev`/`prod`, every push to `dev`/`prod`, and on `gh workflow run ci.yml --ref <branch>`. A local test run happens only when the user asks for one, as the one-file repro of a reported bug (`/diagnose`), or to reproduce a test CI reported red: the narrowest file, `VITEST_MAX_WORKERS=1`. A hook asks before any other.

**During development, run no gates.** Write the code and its tests, run nothing. The gates run once, when the user says commit / push / прогони: the `/check` skill, i.e. `bash .claude/scripts/gates.sh` (typecheck, eslint and prettier on the diff, seconds with turbo's cache).

**Subagents never run gates or tooling.** They hand each check back as `MAIN: <command>` in their report and the main loop runs it, because a long silent run inside an agent dies to the 600s watchdog with nothing to show for it.

**Hooks enforce the hard rules** (`.claude/hooks/`, fixtures in `.claude/scripts/test-hooks.sh`, run it after editing a hook). Bash: no writes to the live databases through the :5532/:5533 tunnels or `APP_ENV=prod|dev`; no destructive git (`reset --hard`, `clean -f`, force push outside `promote-*`, direct push to `prod`/`stage`); commit and PR text passes commitlint with no dashes or AI markers; tooling inside agents is denied; gates in the main loop ask unless the last prompt called for them. Files: generated code, the lockfile, committed migrations and real `.env` files are read-only, and server credentials are unreadable. After every edit in `apps/*/src` or `packages/shared/src`, the lines you introduced are checked for comments, `any`, `!`, `console`, raw date math, `process.env`, layer leaks, memoization, arbitrary Tailwind values and hardcoded Cyrillic. At Stop, a reply that claims done after a code change in that turn (yours or an agent's `CHANGED`) is sent back once unless the turn ran a check or the reply carries a NOT_VERIFIED / Missing split, and so is one that drops an agent's NOT_VERIFIED (`claims-check.sh`). A denial or finding carries its reason: fix the cause, never route around it. A finding you judge false gets one line saying why.

**"Only the files your change touches" has one blind spot, and it is the expensive one.** A contract change breaks callers you never opened — a test fixture, a hand-written frontend caller, a sibling test asserting the old response shape. Whenever the change is contract-shaped (`packages/shared`, a Prisma schema or migration, a repository/service signature, a DI constructor, a request or response body, a `core/**` helper), run the **`/blast-radius`** skill before committing. It greps the consumers so you fix the callers you never opened, and such a change reaches `dev` through a PR (CI tests it, nothing deploys) rather than a direct push. Skipping it on 2026-08-08 put a red deploy on `dev`.

**At commit and push** nothing heavier runs locally. `pre-commit` runs lint-staged on staged files; `pre-push` runs `pnpm typecheck && pnpm lint`. `Deploy` fires on every push to `dev`/`prod` and calls `ci.yml` before any image is built, so a red test blocks the deploy and a push is the real test gate. On a `dev` push and a PR into `dev`, CI runs only the tests affected by the diff since the last green deploy (`vitest --changed`); `packages/shared`, Prisma, test setup, lockfile or config changes, PRs into `prod`, manual runs and the nightly `nightly-tests.yml` run the full sharded suite. A failed shard reruns alone with "Re-run failed jobs". `pnpm test` and `pnpm knip` locally only on the user's explicit request, once, never while another run is live.

BE additionally: `pnpm dev:api` starts clean; `curl -i http://localhost:4000/api/health` → 200 with `x-request-id`; the affected endpoint responds as expected (capture the curl).
FE additionally: `pnpm dev:web` starts clean, no console errors; for UI changes, verify visually (screenshot / Storybook).

Never report done with a failing gate. If a gate fails for an unrelated reason (e.g. a pre-existing flake), say so explicitly. "Tests pass in CI" is a claim only after the run is green — check it, don't assume it.

---

## 10. Delegation (mandatory, automatic, silent)

Route work to the right subagent without narrating or asking. Agents live in `.claude/agents/`, full registry in [`.claude/agents/README.md`](./.claude/agents/README.md). A subagent does **not** see the conversation or the auto memory: pass a self-contained brief (what, where, constraints, what to return). A `SubagentStart` hook already injects the report envelope (`STATUS:` first line, `CHANGED` / `VERIFIED` / `NOT_VERIFIED` with `MAIN:` lines / `FINDINGS` / `QUESTION`) and the no-tooling, no-git rules into every project agent, so a brief does not repeat them. Read `STATUS` and `NOT_VERIFIED` first; run the `MAIN:` lines yourself at gate time. Summarize the result briefly; don't paste the full report. Keep two or three agents running at once at most: six concurrent agents is what preceded a triple watchdog stall.

| Task                                                                      | Agent                                              |
| ------------------------------------------------------------------------- | -------------------------------------------------- |
| Work arrives as a spec / ТЗ md — before ANY code, and again before "done" | `spec-auditor` (via the `/spec-to-ship` chain)     |
| Write/modify React in `apps/web/src/**`                                   | `frontend-engineer`                                |
| Visual polish, motion, typography, color, responsive rhythm               | `design-engineer`                                  |
| Write/modify NestJS/Prisma in `apps/api/src/**`                           | `backend-engineer`                                 |
| Tests in `apps/web/src/**` / `apps/api/src/**`                            | `frontend-test-engineer` / `backend-test-engineer` |
| Refactor / dead code / cleanup                                            | `refactor-specialist`                              |
| End-to-end user-visible feature needing a "what's new" entry              | `changelog-writer`                                 |
| Browser-side bug (UI, console, layout, hydration, interaction)            | `frontend-bug-hunter` (via `/diagnose`)            |
| Server-side bug (500, failing endpoint, Prisma/Postgres error, hang)      | `backend-bug-hunter` (via `/diagnose`)             |
| Red CI test / bug of unclear side                                         | hunter by test path / `frontend-bug-hunter` first  |
| Prisma migration / schema change                                          | `migration-reviewer`                               |
| Release / promote dev→stage→prod, deploy, "залить в прод", "выкати"       | `release-manager`                                  |
| "ready to commit" / "сделай ревью" / "проверь перед commit"               | `code-reviewer` (+ auditors below)                 |
| Anything touching auth / API / forms / env / deps / secrets               | `security-reviewer`                                |
| FE slow / bundle bloat / re-render / web-vitals regression                | `frontend-performance-auditor`                     |
| Accessibility, keyboard nav, ARIA, contrast, focus                        | `accessibility-auditor`                            |
| SEO / SSR markup, metadata, hreflang, sitemap/robots, locale routing      | `seo-auditor`                                      |

**Parallel review** — on "ready to commit" / "полный ревью", launch the relevant reviewers in one turn (multiple Agent calls): always `code-reviewer`; plus `frontend-performance-auditor` / `accessibility-auditor` if the diff touches UI, `seo-auditor` if it touches routing/metadata/next-intl, `security-reviewer` if it touches auth/API/forms/env/deps. To fix what they find, run `/fix-loop`: confirmed findings only, fixed by the path owner, two rounds at most.

**A task with more than one step runs under `/unlazy`**: blocks with their checks in the first reply, every part finished at the asked scope, and a Block | Check | Before | After table plus **Missing** (every agent's NOT_VERIFIED among it) before calling it done.

**A bug runs the whole `/diagnose` chain**, never stopping at the hunter's report: the hunter finds the mechanism, the path owner fixes it while the test engineer writes the regression test, the main loop proves that test red without the fix and green with it, then review. A diagnosis nobody applied is not done.

**Skills** live in `.claude/skills/`; the harness lists each one with its trigger every session, so they are not repeated here. Invoke with `/<name>`.

**Spec-driven work runs as a chain, not head-on** — see [`.claude/skills/spec-to-ship/SKILL.md`](./.claude/skills/spec-to-ship/SKILL.md). Verify the spec against the code before planning, decompose into a checkable `tasks.json`, ask all open decisions in one block, implement slice by slice with per-slice review, then re-audit the diff against `tasks.json` before claiming done. A spec's `file:line` claims are stale until opened; a requirement is optional only when the spec itself says so.

**Do it yourself** (no delegation): trivial answers; reading or explaining existing code; edits in `docs/`; root config (`turbo.json`, `eslint.config.mjs`, `next.config.ts`, `tsconfig.base.json`, `knip.json`); rewriting this file; or when the user says "сделай сам".

---

## 11. Operating notes

- **Local Postgres may be down.** The API tolerates a missing DB at startup (health shows `postgres: "down"`, app still serves). Tests and data endpoints need a local Postgres with the credentials in `apps/api/vitest.config.ts` / `.env` (`pnpm db:up` for the Docker Postgres).
- **Test and database limits are deliberate.** `VITEST_MAX_WORKERS` (default 3), the Postgres CPU/memory caps and its relaxed durability settings each have a measured reason, recorded in `.claude/rules/test-load.md` (loads when you open `docker-compose.yml`, a vitest config or `apps/api/src/test/`). Read it before changing any of them.
- **Modular monolith.** Service extraction comes later, only when a real boundary demands it — the only preparation is keeping module boundaries clean.
- **Per-user memory** at `~/.claude/projects/-Users-macbookpro14-WebstormProjects-book-nest/memory/` is auto-loaded and captures evolved feedback across sessions — honor it.

---

## 12. Working with the AI assistant

- Respond in **Russian**; code, paths, commands, and output stay in English.
- Terse by default: short status, no narration of upcoming steps, no trailing recaps.
- **Explain the why deeply for backend and non-obvious decisions.** The maintainer is a senior frontend engineer deepening backend/infra expertise — when a NestJS/Prisma/Postgres/HTTP/git-infra concept or a non-obvious tradeoff comes up, teach the mental model and the reasoning, with FE analogies where they help. This is depth on **concepts**, not narration of routine mechanical steps (those stay terse). When the concept deserves a real lesson rather than a paragraph in passing, use `/teach` — it records what landed, so the next lesson starts higher.
- **Text a human reads follows `/prose`**, not this file's own style: README, `docs/`, changelog, release notes, PR bodies, commit messages. Plain sentences, no em-dashes, no "Generated with Claude Code" footer. Files under `.claude/` are read by a model and follow `/writing-for-agents` instead.
- Delegation is automatic and silent (§10).
- Avoid: comments in code, unverified "should work" claims, chatter, asking permission for routine work, wrapper libraries over standard tools, premature optimization, hardcoded values that belong in env.
