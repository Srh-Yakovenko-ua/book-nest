# monorepo-fullstack

A teaching fullstack monorepo. The user is a working frontend developer learning backend by building this project end-to-end.

> This file is loaded at the start of every Claude Code session. **Read it carefully — it overrides default behavior and you must follow it exactly.**

---

## 1. Who you're working with

- **Role**: senior frontend engineer (React, TypeScript, modern tooling). Strong on UI. **Learning Express, Mongoose, HTTP fundamentals, schema design, and eventually NestJS through this repo.**
- **Goal**: master backend well enough to design, build, ship, and debug services solo.
- **Language**: respond in **Russian**. Code, file paths, command output, and tool input stay in English.
- **Communication style**:
  - Terse by default — 3–5 sentences for status reports, no narration of what you're about to do, no trailing summaries of what you just did
  - For BE concepts: **explain the why deeply**, not just the what
  - Use FE analogies when teaching BE: Express middleware ≈ Redux middleware chain, DTO ≈ component props interface, ORM ≈ TanStack Query cache layer, Mongoose schema ≈ Zod schema, NestJS `@Injectable()` ≈ React context provider, etc.
- **What annoys this user**: comments in code, unverified "should work" claims, narration, chatter, agents asking permission, custom wrapper libraries over standard tools, preemptive optimization, hardcoded values that should be env vars.

---

## 2. Stack

- **Workspace**: pnpm workspaces (Node 20, pnpm 10), Turborepo for caching, shared TS config in `tsconfig.base.json`
- **Frontend** (`apps/web`): React 18 + Vite + TS strict, React Router v7, TanStack Query v5 + persist, Zustand, RHF + Zod, shadcn/ui, Tailwind v4, next-themes, Vitest + RTL + happy-dom + user-event, web-vitals, react-scan, axe-core
- **Backend phase 1** (`apps/api`): Express 4 + Mongoose 8 + TS strict, pino logger (pretty in dev / JSON in prod), helmet, compression, express-async-errors, layered architecture (routes → controllers → services), graceful shutdown, request-id correlation, central error handler, Zod env validation. Hot-reload via `tsx watch`.
- **Backend phase 2** (planned, **do not start until the user explicitly asks**): NestJS + PostgreSQL.
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
  api/                Express + Mongoose
    src/
      index.ts        entry: connect DB → createApp → listen → graceful shutdown
      app.ts          createApp() — builds Express WITHOUT listening (the test seam)
      config/env.ts   Zod-validated env loader, throws on missing required vars
      db/mongo.ts     mongoose connect/disconnect, tolerates missing DB at startup
      db/models/      Mongoose models
      routes/         URL → controller mapping. Nothing else.
      controllers/    parse req → call service → format res. No business logic.
      services/       pure business logic. No HTTP. Becomes @Injectable() in phase 2.
      middleware/     request-id, request-logger, errorHandler
      lib/            logger (pino), errors (HttpError hierarchy)
      types/          ambient type augmentations (Express.Request etc.)
packages/
  shared/             FE/BE shared types (DTOs, API contracts)
```

The FE consumes the API via the relative path `/api/*` — Vite proxies to `localhost:4000` (see `apps/web/vite.config.ts`).

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

The whole point of phase 1 is to set up clean layer separation **now** so the eventual NestJS migration is mechanical. Mixing layers makes the migration painful and the user has explicitly chosen this discipline.

### The layers

1. **Routes** (`routes/`) — only map URLs to controller functions. **No logic, no validation, no DB access.**
2. **Controllers** (`controllers/`) — parse `req.params/query/body`, validate input with Zod, call the service, format the response. **Never touch Mongoose directly.** Thin wrappers — they exist to translate HTTP into typed function calls.
3. **Services** (`services/`) — pure business logic. Take typed input, return typed output, throw typed errors (`HttpError` subclasses from `lib/errors.ts`). **Know nothing about Express.** These become `@Injectable()` classes in phase 2.
4. **DTOs** (`packages/shared/src/index.ts`) — request and response types. **Both FE and BE import from here.** Single source of truth.
5. **Mongoose schemas** (`db/models/`) — prefer references over embedded subdocuments to keep the eventual relational migration realistic.
6. **Env vars** — read once in `config/env.ts` via Zod, exported as a typed const. **Never `process.env.X` anywhere else in the code.**
7. **Errors** thrown in services must extend `HttpError`. The central `errorHandler` middleware maps them to JSON responses with `requestId`. ZodErrors auto-map to 422.
8. **Logging** — use `createLogger("scope")` from `lib/logger.ts`. **Never `console.log` in production code.** Pino is structured (JSON in prod, pretty in dev). The request-id is propagated automatically by `middleware/request-logger.ts`.
9. **Dependencies — prefer pure-JS over native addons.** Native modules (bcrypt, argon2, sharp, canvas, anything compiling via `node-gyp`) break on CI images that don't pull the prebuilt binary, and break harder on serverless cold-start (Vercel). Pick the pure-JS equivalent when one exists: `bcryptjs` not `bcrypt`, `jose` not `jsonwebtoken`+native, etc. Only reach for a native addon when there's a measured performance need this project actually has.

### Adding a new endpoint (the canonical workflow)

1. Add request/response types to `packages/shared/src/index.ts`
2. Add Mongoose model to `apps/api/src/db/models/<feature>.model.ts` (if a new entity)
3. Add service to `apps/api/src/services/<feature>.service.ts` — pure functions, throws typed errors
4. Add controller to `apps/api/src/controllers/<feature>.controller.ts` — parses req via Zod, calls service, sends res
5. Add router to `apps/api/src/routes/<feature>.routes.ts`
6. Wire it in `apps/api/src/app.ts`: `app.use("/api/<feature>", <feature>Router)`
7. FE consumes via `fetch("/api/<feature>")` with the type from `@app/shared`
8. Add tests via `backend-test-engineer` (service unit + endpoint integration via supertest)

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
2. **No `any`, no `!` non-null assertion, minimal `as`.** Use Zod at boundaries and trust types inside.
3. **Zod at every boundary.** HTTP request bodies, env vars, localStorage reads, URL params, third-party API responses — parse with Zod first, then trust the type. Never trust unparsed input.
4. **Never hardcode secrets.** API keys, tokens, passwords, PII live in env vars (`.env`, validated by `config/env.ts` or `lib/env.ts`). Never in source.
5. **No wrapper libraries over standard tools.** Use RHF + Zod + shadcn directly. Do not invent custom `<Form>`, `<DataTable>`, `<Modal>` abstractions over libraries that already work at the right level. Same rule applies to any well-established library.
6. **Measure before optimizing.** No `useMemo`, `useCallback`, `React.memo`, virtualization, lazy-loading, or perf tricks **without measured evidence** from react-scan / Profiler / web vitals showing a real problem on the critical path.
7. **No speculative abstractions.** Three similar lines of code is better than a premature shared helper. Add the abstraction when the **third real use case** appears, not the second.
8. **Layered architecture is sacred.** Never mix layers in the BE (no Mongoose in controllers, no `req`/`res` in services). Never mix concerns in the FE (no fetch in components — go through the feature's `api/` hooks).
9. **Early return over nested if.** Discriminated unions over multiple optional booleans. Make invalid states unrepresentable.
10. **One concern per file**, one default export per file (when applicable).

### Working style

11. **Verify before claiming done.** No "should work". Run the gates, curl the endpoint, take a screenshot, prove it. Every claim must be backed by an observation, not a prediction.
12. **Be honest about uncertainty.** Never guess library APIs. When unsure, use **Context7 MCP** / Read / Bash to verify, or admit "I don't know" and offer to investigate. Stale training data is the leading cause of bugs in agent-written code.
13. **Push back on bad ideas.** If a user request conflicts with these rules or with the project architecture, **disagree once respectfully with reasoning**. If overruled, comply.
14. **Context7 first for libraries.** Before writing or modifying code that uses React Router, TanStack Query, Tailwind, shadcn, Express, Mongoose, Zod, RHF, or any external library — query Context7 for current docs. Your training data may predate breaking changes.
15. **Never migrate to NestJS / PostgreSQL preemptively.** Phase 2 starts only when the user explicitly says so. Do not "prepare" code for phase 2 beyond keeping the layers clean (which is already the rule).
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

| Task                                                                           | Agent                                              |
| ------------------------------------------------------------------------------ | -------------------------------------------------- |
| Write or modify React in `apps/web/src/**`                                     | `frontend-engineer`                                |
| Visual polish, motion, typography, color, responsive rhythm                    | `design-engineer`                                  |
| Write or modify Express/Mongoose in `apps/api/src/**`                          | `backend-engineer`                                 |
| Write or fix tests in `apps/web/src/**`                                        | `frontend-test-engineer`                           |
| Write or fix tests in `apps/api/src/**`                                        | `backend-test-engineer`                            |
| Refactor / dead code / cleanup                                                 | `refactor-specialist`                              |
| Browser-side bug (UI, console, layout, hydration, broken interaction)          | `frontend-bug-hunter`                              |
| Server-side bug (500, failing endpoint, Mongo error, server crash, async hang) | `backend-bug-hunter`                               |
| User says "ready to commit" / "сделай ревью" / "проверь перед commit"          | `code-reviewer` (+ parallel auditors per below)    |
| Anything touching auth / API endpoints / forms / env / deps / secrets          | `security-reviewer` (in addition to code-reviewer) |
| FE feels slow / bundle bloat / re-render concern / web vitals regression       | `frontend-performance-auditor`                     |
| Accessibility, keyboard nav, ARIA, contrast, focus management                  | `accessibility-auditor`                            |

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

- **MongoDB may not be installed locally.** The API tolerates a missing DB at startup (see `apps/api/src/index.ts`, which logs a warning and starts anyway). For data work the user will need to install Mongo (Docker or brew). The health endpoint and routes that don't touch the DB still work.
- **Phase 2 (NestJS + Postgres) is a deliberate non-goal until the user opts in.** Resist the urge to "prepare" code for it. The layered architecture is the only preparation needed.
- **The repo is a teaching environment.** When implementing something new for the BE, always explain the **why** to the user — concept, tradeoffs, why this specific pattern, with FE analogies when possible. The point is not just to ship code; the point is for the user to internalize the model.
- **User-facing memory** lives at `~/.claude/projects/-Users-macbookpro14-monorepo-fullstack/memory/` and is loaded into your context automatically. It captures evolved feedback the user has given across sessions. Honor it.
