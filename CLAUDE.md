# monorepo-fullstack

A teaching fullstack monorepo. The user is a working frontend developer learning backend by building this project end-to-end.

> This file is loaded at the start of every Claude Code session. **Read it carefully — it overrides default behavior and you must follow it exactly.**

---

## 1. Who you're working with

- **Role**: senior frontend engineer (React, TypeScript, modern tooling). Strong on UI. **Learning NestJS, Prisma, PostgreSQL, HTTP fundamentals, and relational schema design through this repo.**
- **Goal**: master backend well enough to design, build, ship, and debug services solo.
- **Language**: respond in **Russian**. Code, file paths, command output, and tool input stay in English.
- **Communication style**:
  - Terse by default — 3–5 sentences for status reports, no narration of what you're about to do, no trailing summaries of what you just did
  - For BE concepts: **explain the why deeply**, not just the what
  - Use FE analogies when teaching BE: NestJS middleware/interceptor ≈ Redux middleware chain, DTO ≈ component props interface, ORM ≈ TanStack Query cache layer, Prisma schema ≈ a Zod schema for your database, NestJS `@Injectable()` ≈ React context provider, NestJS guard ≈ a route loader's `redirect()`, etc.
- **What annoys this user**: comments in code, unverified "should work" claims, narration, chatter, agents asking permission, custom wrapper libraries over standard tools, preemptive optimization, hardcoded values that should be env vars.

---

## 2. Stack

- **Workspace**: pnpm workspaces (Node 24, pnpm 10), Turborepo for caching, shared TS config in `tsconfig.base.json`
- **Frontend** (`apps/web`): **Next.js 16 (App Router, RSC/SSR)** + React 19 + TS strict, **next-intl** locale-routing (`/[locale]/`, ru/en/uk) for multilingual SEO, TanStack Query v5 (SSR-safe), Zustand, RHF + Zod, shadcn/ui, Tailwind v4 (PostCSS), next-themes, Vitest + RTL + happy-dom + user-event, web-vitals, react-scan. File-based routing under `src/app/`; locale middleware in `src/proxy.ts`. (Migrated off Vite + React Router for SSR/SEO.)
- **Backend** (`apps/api`): **NestJS 11 + Prisma 7 (engineless, `@prisma/adapter-pg` driver adapter) + PostgreSQL** + TS strict (ESM). Feature-sliced layered modules (`api / application / domain / infrastructure`), nestjs-zod + Zod validation pipes, @nestjs/swagger, pino logger (pretty dev / JSON prod), helmet, compression, @nestjs/throttler, jose (JWT), bcryptjs, OpenTelemetry + prom-client, graceful shutdown, request-id correlation, global `HttpErrorFilter`, Zod-validated env. Hot-reload via `@swc-node/register --watch` (**not** `tsx` — it strips the decorator metadata Nest DI needs). Schema in `prisma/schema.prisma`, client generated to `src/generated/prisma`, schema changes via `prisma migrate`.
- **Shared** (`packages/shared`): DTOs and API contracts imported as `@app/shared`. **Single source of truth for FE/BE type alignment.**

---

## 3. Repo layout

```
apps/
  web/                React + Vite
    src/
      routes/         React Router routes
      features/       feature-sliced (api/ components/ hooks/ index.ts)
      components/     shared components (ui/ for shadcn primitives)
      lib/            env, http-client, query-client, logger, format, vitals
      hooks/          shared hooks
      main.tsx, App.tsx, index.css
  api/                NestJS + Prisma (Postgres)
    prisma/
      schema.prisma   datasource + generator + model blocks — schema source of truth
      migrations/     reviewable SQL migrations (prisma migrate)
    prisma.config.ts  Prisma CLI config (loads .env, schema + migrations paths)
    src/
      index.ts        entry: bootstrap Nest → listen → graceful shutdown
      bootstrap.ts    bootstrapNestApp() — helmet, cors, cookies, swagger, global filter
      app.module.ts   root @Module — feature modules + DatabaseModule + middleware
      config/env.ts   Zod-validated env loader, exits on missing required vars
      core/           cross-cutting infra: database/, pipes/, exceptions/, middleware/, logger, paginator, tracing
        database/     PrismaService (extends PrismaClient) + @Global DatabaseModule
      modules/        one folder per feature (health, observability, …)
        <feature>/    api/ (controllers + DTOs) · application/ (services) · domain/ (types) · infrastructure/ (Prisma repositories)
      generated/prisma  generated Prisma client (gitignored, via prisma generate)
      test/           createTestApp, truncate, global-setup
packages/
  shared/             FE/BE shared types (DTOs, API contracts)
```

The FE consumes the API via the relative path `/api/*` — Next.js `rewrites()` proxy to the API server (see `apps/web/next.config.ts`, target `API_BASE_URL`, default `localhost:4000`). Server-side (RSC) fetches hit `API_BASE_URL` directly with cookie forwarding.

---

## 4. Commands (run from repo root)

| Command             | Purpose                                       |
| ------------------- | --------------------------------------------- |
| `pnpm install`      | Install all dependencies                      |
| `pnpm dev`          | FE (`:5173`) and BE (`:4000`) in parallel     |
| `pnpm dev:web`      | FE only                                       |
| `pnpm dev:api`      | BE only                                       |
| `pnpm typecheck`    | TS check across all packages                  |
| `pnpm build`        | Build all packages                            |
| `pnpm lint`         | ESLint root config, all packages              |
| `pnpm lint:fix`     | ESLint with auto-fix                          |
| `pnpm format`       | Prettier — write                              |
| `pnpm format:check` | Prettier — check only (CI mode)               |
| `pnpm test`         | Vitest across packages that have tests        |
| `pnpm knip`         | Detect dead code, unused exports, unused deps |

---

## 5. Backend architecture — non-negotiable

Clean layer separation is non-negotiable: business logic stays independent of HTTP **and** of the data layer. This keeps each layer testable in isolation and keeps the eventual service extraction (microservices) mechanical. The canonical backend reference is [`.claude/agents/backend-engineer.md`](./.claude/agents/backend-engineer.md) and [`docs/code-principles.md`](./docs/code-principles.md).

### The layers (feature-sliced NestJS module)

1. **Controllers** (`modules/<feature>/api/`) — `@Controller("api/<feature>")`. Validate `@Body`/`@Query` via `ZodBodyPipe`/`ZodQueryPipe`, call the service, return the value (Nest serializes). **No Prisma, no business logic.** Swagger via `@Api*` + `createZodDto`.
2. **Services** (`modules/<feature>/application/`) — `@Injectable()` pure business logic. Typed input → typed output, throw `HttpError` subclasses from `core/exceptions/`, **map the Prisma model → ViewModel DTO**, wrap multi-write flows in `TransactionRunner.run(...)` from `core/database` — **services never inject `PrismaService`**. **Know nothing about `req`/`res`.**
3. **Repositories** (`modules/<feature>/infrastructure/`) — `@Injectable()`, inject `PrismaService`, call `this.prisma.<model>.*`. **The only layer that touches Prisma** (besides `core/database`). Methods take an optional trailing `client: Prisma.TransactionClient = this.prisma` so a service-owned transaction can be threaded through. Return model rows / primitives — never a ViewModel.
4. **Models** (`prisma/schema.prisma`) — `model` blocks. snake_case columns via `@map`/`@@map`, explicit relations, UUID PKs. Schema changes go through reviewed `prisma migrate` SQL — **never `db push`/auto-sync against shared data**.
5. **DTOs** (`packages/shared/src/index.ts`) — request/response Zod schemas + types. **Both FE and BE import from here.** `createZodDto` wraps them for Swagger.
6. **Env vars** — read once in `config/env.ts` via Zod, exported as a typed const. **Never `process.env.X` anywhere else** (except `prisma.config.ts`).
7. **Errors** thrown in services must extend `HttpError` (`core/exceptions/`). The global `HttpErrorFilter` maps them to JSON with `requestId`. ZodErrors auto-map to 400/422.
8. **Logging** — `createLogger("scope")` from `core/logger.ts`. **Never `console.log` in production code.** Pino is structured (JSON in prod, pretty in dev); request-id is propagated by `RequestLoggerMiddleware`.
9. **Dependencies — prefer pure-JS over native addons.** Native modules (bcrypt, argon2, sharp, canvas, anything via `node-gyp`) break on bare CI images and serverless cold-start. Pick the pure-JS equivalent: `bcryptjs` not `bcrypt`, `jose` not `jsonwebtoken`+native. (Prisma 7 is engineless — no Rust binary — which is why we're on it.) Only reach for a native addon under a measured need.

### Adding a new endpoint (the canonical workflow)

1. Add request/response Zod schema + types to `packages/shared/src/index.ts`
2. Add a `model` to `apps/api/prisma/schema.prisma` (if a new entity)
3. **Two-step migration flow (never one-shot).** `pnpm --filter @app/api db:migrate --name <snake_case_name>` creates a **review-only** migration (`migrate dev --create-only`, no apply) — a name is required (the script fails fast instead of hanging on the interactive name prompt; **never run bare `prisma migrate dev`** — it prompts for a name and blocks forever in a non-TTY agent shell). Review the generated `migration.sql` (loop in `migration-reviewer`; watch the rename trap), then apply with `pnpm --filter @app/api db:migrate:deploy` (non-interactive, advisory-locked). **Raw-SQL-index trap:** three indexes live in raw SQL inside their migrations because Prisma can't express them in a `model`: the GIN trigram indexes `authors_search_text_trgm_idx` and `publishers_search_text_trgm_idx` (`gin_trgm_ops`), and the partial unique index `book_deliveries_active_book_idx` (one active delivery per book, `WHERE status IN ('ordered','in_transit','ready_for_pickup')`). They exist in the DB but not in `schema.prisma`, so every generated migration will emit a spurious `DROP INDEX` for them — hand-strip those lines **before** `db:migrate:deploy`, or cross-locale search silently degrades to a seq scan and the one-active-delivery invariant is silently dropped. (This is exactly why the flow is create-then-apply, not one-shot.)
4. Repository in `modules/<feature>/infrastructure/` — inject `PrismaService`, parameterized queries only
5. Service in `modules/<feature>/application/` — business logic, throws `HttpError` subclasses, maps model → ViewModel, `TransactionRunner.run(...)` for multi-write
6. Input DTO classes in `api/input-dto/` via `createZodDto(Schema)`
7. Controller in `api/` — `@Get/@Post`, Zod pipes, `@UseGuards` if auth, full `@Api*` Swagger
8. Module (`<feature>.module.ts`) + wire it in `app.module.ts`
9. Tests via `backend-test-engineer` (service unit + controller integration via `createTestApp`)
10. FE consumes via `fetch("/api/<feature>")` with the type from `@app/shared`

---

## 6. Frontend conventions

- **Feature-sliced layout** in `src/features/<name>/` with subfolders: `api/` (TanStack Query hooks + http-client + Zod parsing), `components/`, `hooks/`, optional `routes.tsx`, barrel `index.ts` for the public API
- **Shadcn primitives** live in `src/components/ui/` — vendored, do not edit unless polishing the primitive itself. `Button` and `DropdownMenuItem` already have `cursor-pointer` baked in.
- **Forms**: react-hook-form + zod + shadcn primitives **directly**. Do not build wrapper `<Form>` / `<FormField>` abstractions.
- **Data fetching**: TanStack Query. Mock at the `fetch` boundary in tests, never mock RQ hooks.
- **Routing**: React Router v7 (`createBrowserRouter`).
- **State**: Zustand for client-only UI state. Server state lives in TanStack Query.
- **Styling**: Tailwind v4 with semantic CSS variables in `src/index.css`. Use semantic tokens (`bg-background`, `text-foreground`, `text-primary`, `text-muted-foreground`), **not** raw colors (`bg-blue-500`).
- **Theme**: `next-themes` with light/dark/system, palette in OKLCH for proper interpolation.
- **Clickable elements** must have `cursor-pointer`. Already in `Button` and `DropdownMenuItem`; apply explicitly to custom click handlers.
- **Env**: read once in `src/lib/env.ts` via Zod, exported as a typed const. Never `import.meta.env.X` directly elsewhere.

---

## 7. Non-negotiable rules

### Code style

1. **No comments.** Write self-documenting code. No file headers, no inline narration, no JSDoc on internal functions. If a comment seems needed, **rename the symbol until the code explains itself**. Comments are tech debt.
2. **No `any`, no `!` non-null assertion, minimal `as`.** Use Zod at boundaries and trust types inside. Prefer the shared type utilities `Nullable<T>` and `ValueOf<T>` (from `@app/shared`) over hand-written `T | null` / `T[keyof T]` — one source of truth for FE and BE. Full TS canon: [`docs/typescript-principles.md`](./docs/typescript-principles.md).
3. **Zod at every boundary.** HTTP request bodies, env vars, localStorage reads, URL params, third-party API responses — parse with Zod first, then trust the type. Never trust unparsed input.
4. **Never hardcode secrets.** API keys, tokens, passwords, PII live in env vars (`.env`, validated by `config/env.ts` or `lib/env.ts`). Never in source.
5. **No wrapper libraries over standard tools.** Use RHF + Zod + shadcn directly. Do not invent custom `<Form>`, `<DataTable>`, `<Modal>` abstractions over libraries that already work at the right level. Same rule applies to any well-established library.
6. **Measure before optimizing.** No `useMemo`, `useCallback`, `React.memo`, virtualization, lazy-loading, or perf tricks **without measured evidence** from react-scan / Profiler / web vitals showing a real problem on the critical path.
7. **DRY the knowledge, not the resemblance — and never abstract prematurely.** Eliminate real duplication: a business rule, a type, or a contract has **one source of truth** (don't copy the same logic into N places). But _incidental_ similarity — two things that merely look alike yet are different concerns and will evolve apart (e.g. FE `lib/env.ts` vs BE `config/env.ts`) — is **not** duplication; leave it. Three similar lines beat a premature shared helper; lift logic into a reusable module/class only on the **third real use** or genuine shared knowledge, not the second. Optimize for **changeability**: easy-to-delete > easy-to-extend, coupling down + cohesion up, changes stay localized. The wrong abstraction costs more than duplication. Full reference: [`docs/code-principles.md`](./docs/code-principles.md) — §0.0 (the twelve levers against complexity), §7.2 (when to extract).
8. **Layered architecture is sacred.** Never mix layers in the BE (no Prisma in controllers, no Prisma outside the repository layer, no `req`/`res` in services, repositories never return a ViewModel). Never mix concerns in the FE (no fetch in components — go through the feature's `api/` hooks).
9. **Early return over nested if.** Discriminated unions over multiple optional booleans. Make invalid states unrepresentable.
10. **One concern per file**, one default export per file (when applicable).

### Working style

11. **Verify before claiming done.** No "should work". Run the gates, curl the endpoint, take a screenshot, prove it. Every claim must be backed by an observation, not a prediction.
12. **Be honest about uncertainty.** Never guess library APIs. When unsure, use **Context7 MCP** / Read / Bash to verify, or admit "I don't know" and offer to investigate. Stale training data is the leading cause of bugs in agent-written code.
13. **Push back on bad ideas.** If a user request conflicts with these rules or with the project architecture, **disagree once respectfully with reasoning**. If overruled, comply.
14. **Context7 first for libraries.** Before writing or modifying code that uses Next.js, TanStack Query, Tailwind, shadcn, NestJS, Prisma, Zod, RHF, or any external library — query Context7 for current docs. Your training data may predate breaking changes.
15. **Migrations are the source of truth.** Schema changes go through `prisma migrate` + reviewed SQL (loop in `migration-reviewer`) — never `prisma db push` or auto-sync against shared data. Don't scaffold roadmap features (OAuth, WebSockets, RabbitMQ, microservices, Docker, payments) preemptively — build each when a real feature needs it, keeping module boundaries clean so service extraction stays mechanical.
16. **Investigate before destructive actions.** Before `rm`, `git reset --hard`, `git push --force`, dropping databases, or anything irreversible — confirm with the user. Confirmation is cheap, lost work is not.

---

## 8. Quality gates (must all pass before "done")

```bash
pnpm typecheck     # TS strict across all packages
pnpm lint          # ESLint root config
pnpm format:check  # Prettier
pnpm test          # Vitest, where tests exist
pnpm knip          # dead code, unused exports, unused deps
```

For BE work, additionally:

- `pnpm dev:api` starts cleanly
- `curl -i http://localhost:4000/api/health` → 200, `x-request-id` header present, JSON body
- The affected endpoint responds as expected (capture the curl output)

For FE work, additionally:

- `pnpm dev:web` starts cleanly, no console errors on the affected page
- For UI changes, take a Playwright screenshot and verify visually

**Never report a task as done if any gate is failing.** If a gate is failing for an unrelated reason (e.g., a pre-existing flaky test), say so explicitly.

---

## 9. Delegation policy (mandatory, automatic, silent)

The user has explicitly opted into automatic delegation. **You must route work to the right specialized subagent silently, without asking permission.** Do not narrate "I'll delegate this to X" — just do it. The user does not want to think about which agent to use.

Project subagents live in `.claude/agents/`. Full registry and roles in [`.claude/agents/README.md`](./.claude/agents/README.md).

### When to delegate

| Task                                                                                     | Agent                                              |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Write or modify React in `apps/web/src/**`                                               | `frontend-engineer`                                |
| Visual polish, motion, typography, color, responsive rhythm                              | `design-engineer`                                  |
| Write or modify NestJS/Prisma in `apps/api/src/**`                                       | `backend-engineer`                                 |
| Write or fix tests in `apps/web/src/**`                                                  | `frontend-test-engineer`                           |
| Write or fix tests in `apps/api/src/**`                                                  | `backend-test-engineer`                            |
| Refactor / dead code / cleanup                                                           | `refactor-specialist`                              |
| Browser-side bug (UI, console, layout, hydration, broken interaction)                    | `frontend-bug-hunter`                              |
| Server-side bug (500, failing endpoint, Postgres/Prisma error, server crash, async hang) | `backend-bug-hunter`                               |
| User says "ready to commit" / "сделай ревью" / "проверь перед commit"                    | `code-reviewer` (+ parallel auditors per below)    |
| Anything touching auth / API endpoints / forms / env / deps / secrets                    | `security-reviewer` (in addition to code-reviewer) |
| FE feels slow / bundle bloat / re-render concern / web vitals regression                 | `frontend-performance-auditor`                     |
| Accessibility, keyboard nav, ARIA, contrast, focus management                            | `accessibility-auditor`                            |
| SEO / SSR markup, metadata, hreflang, sitemap/robots, locale routing                     | `seo-auditor`                                      |

> **No `backend-performance-auditor` exists yet** — by the measure-before-optimizing rule, we'll create it when there's a real measured BE perf problem to investigate (slow endpoints, N+1, memory growth in Node).

### When NOT to delegate (do it yourself)

- Trivial one-line answer
- User explicitly says "сделай сам" / "не делегируй" / "do it yourself"
- Mixed task spanning half the repo where holding context yourself is more efficient
- Reading or explaining existing code without modification
- Doc edits in `docs/`
- Root-level config tweaks (`turbo.json`, `eslint.config.mjs`, `vite.config.ts`, `tsconfig.base.json`, `knip.json`)
- Rewriting `CLAUDE.md` itself

### Parallel review agents

When the user says "ready to commit" / "сделай полный ревью" / "проверь перед commit", launch **multiple review agents in parallel** in a single message (multiple Agent tool calls in one assistant turn):

- `code-reviewer` — always
- `frontend-performance-auditor` — if diff touches `apps/web/src/**`
- `accessibility-auditor` — if diff touches UI
- `seo-auditor` — if diff touches routing, metadata, `app/[locale]/**`, sitemap/robots, or next-intl wiring
- `security-reviewer` — if diff touches auth / API / forms / env / deps

They have non-overlapping concerns, run in parallel, and you get multiple independent reports in one round-trip.

### How to delegate

Use the `Agent` tool with `subagent_type` matching the agent file name (without `.md`):

- `subagent_type: "frontend-engineer"`
- `subagent_type: "backend-engineer"`
- `subagent_type: "backend-bug-hunter"`
- `subagent_type: "backend-test-engineer"`
- etc.

Pass a **self-contained brief** in `prompt`. The agent does **not** see this conversation. Include:

1. **What** to do (concrete, specific, no ambiguity)
2. **Where** to look — file paths, search hints
3. **Constraints** — what not to break, style to follow, specific rules from this CLAUDE.md the agent must respect
4. **What to return** — summary, file list, verification result

### After delegation

- Summarize the agent's result **briefly** to the user (3–5 sentences). Do not paste the full report.
- If the agent found problems, decide whether to fix immediately (delegate to another agent) or surface to the user for direction.
- If the agent completed cleanly, give a 1–2 sentence summary plus the next step.

---

## 10. Operating notes

- **Postgres may not be running locally** with the `booknest` role / `booknest_test` DB. The API tolerates a missing DB at startup (health degrades to `postgres: "down"`, the app still serves). Tests and data endpoints need a local Postgres (Docker or brew) with the credentials in `apps/api/vitest.config.ts` / `.env`.
- **Roadmap features are built when a real feature needs them — never scaffolded preemptively** (OAuth, WebSockets, transactions, Docker, RabbitMQ, microservices, payments). The backend is a modular monolith; service extraction comes later, only when a real boundary demands it. Keeping module boundaries clean is the only preparation needed.
- **The repo is a teaching environment.** When implementing something new for the BE, always explain the **why** to the user — concept, tradeoffs, why this specific pattern, with FE analogies when possible. The point is not just to ship code; the point is for the user to internalize the model.
- **User-facing memory** lives at `~/.claude/projects/-Users-macbookpro14-WebstormProjects-book-nest/memory/` and is loaded into your context automatically. It captures evolved feedback the user has given across sessions. Honor it.
