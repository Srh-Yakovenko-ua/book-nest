---
name: new-endpoint
description: Scaffold a full feature-sliced NestJS endpoint in apps/api following the canonical workflow — shared DTO → Prisma model → reviewed migration → repository → service → input DTO → controller → module wiring → tests. Use when adding a new backend endpoint so it lands in the layered shape (api/application/domain/infrastructure) with clean layer separation instead of ad-hoc.
disable-model-invocation: true
---

# Scaffold a backend endpoint (apps/api)

Stack: NestJS 11 + Prisma 7 (engineless, `@prisma/adapter-pg`) + PostgreSQL, TS strict (ESM). Feature-sliced layered modules. Layer separation is non-negotiable: business logic knows nothing about HTTP or Prisma; only the repository touches Prisma; controllers do no business logic. The reference is [`.claude/agents/backend-engineer.md`](../../agents/backend-engineer.md) and [`docs/code-principles.md`](../../../docs/code-principles.md).

Most implementation here is `backend-engineer`'s job — this skill is the ordered checklist that keeps the slice canonical. Hand the actual NestJS/Prisma writing to `backend-engineer`; hand tests to `backend-test-engineer`. Do not skip the migration review.

## 1. Name and scope

Ask the user for the feature name (kebab-case, e.g. `books`, `authors`, `library`) and the route + verb(s) (e.g. `GET /api/books`, `POST /api/books`, `GET /api/books/:id`). Confirm whether it introduces a new entity (new Prisma model) or reuses an existing one. A read-only endpoint over an existing model skips steps 2–3's migration.

## 2. Contract first — shared DTO

Add the request/response Zod schema + inferred types to `packages/shared/src/index.ts` (imported as `@app/shared`). This is the single source of truth FE and BE both import. Response shape is the **ViewModel** the service will map to — never the raw Prisma row. Keep input schemas (body/query/params) and output schemas separate.

## 3. Model + migration (only for a new entity / column)

- Add or edit the `model` block in `apps/api/prisma/schema.prisma`. snake_case columns via `@map`/`@@map`, explicit relations, UUID PK (`@id @default(uuid())`), timestamps `@db.Timestamptz`.
- Create and apply the migration via the **`/db-migrate` skill** — it routes the SQL through `migration-reviewer` and guards the rename data-loss trap. Never `prisma db push` against shared data.

## 4. Repository — `modules/<feature>/infrastructure/`

`@Injectable()`, inject `PrismaService`, call `this.prisma.<model>.*` with parameterized queries only. **The only layer that touches Prisma.** Returns model rows / primitives — never a ViewModel. No business logic, no HTTP.

## 5. Service — `modules/<feature>/application/`

`@Injectable()`, pure business logic: typed input → typed output. Throws `HttpError` subclasses from `core/exceptions/` (never raw `throw`). **Maps the Prisma model → ViewModel DTO** from `@app/shared`. Wraps multi-write flows in `prisma.$transaction(...)`. Knows nothing about `req`/`res`. Uses `createLogger("<feature>")` from `core/logger.ts` — never `console.log`.

## 6. Input DTOs — `modules/<feature>/api/input-dto/`

Wrap the `@app/shared` schemas with `createZodDto(Schema)` so Swagger picks them up. One class per request shape.

## 7. Controller — `modules/<feature>/api/`

`@Controller("api/<feature>")`. `@Get/@Post/...` validate `@Body`/`@Query`/`@Param` via `ZodBodyPipe`/`ZodQueryPipe`, call the service, return the value (Nest serializes). `@UseGuards(...)` if auth is required. Full Swagger via `@Api*` decorators + the `createZodDto` classes. **No Prisma, no business logic.**

## 8. Module + wiring

Create `modules/<feature>/<feature>.module.ts` declaring the controller + service + repository providers, and register it in `apps/api/src/app.module.ts`. `PrismaService` comes from the `@Global` `DatabaseModule` — do not re-provide it.

## 9. Env vars (if the endpoint needs config)

Add the variable to the Zod schema in `apps/api/src/config/env.ts` and to `.env.example`. Read it only from the exported typed `env` const — never `process.env.X` elsewhere. Never hardcode secrets.

## 10. Tests — hand to `backend-test-engineer`

- Service unit test: direct class instantiation, repository mocked — assert business logic, error paths (`HttpError` subclasses), and model→ViewModel mapping.
- Controller integration test: against a minimal Nest app via `createTestApp(imports)`, real `booknest_test` Postgres (truncated per test) — assert status codes, validation (400/422), and response shape.

## 11. Verify (gates)

```bash
pnpm --filter @app/api typecheck
pnpm lint
pnpm --filter @app/api test     # real Postgres booknest_test required
pnpm knip
```

Then prove it runs:

```bash
pnpm dev:api
curl -i http://localhost:4000/api/<feature>     # capture status, x-request-id, JSON body
```

Never report done on a prediction — capture the curl output.

## 12. FE consumption (optional, separate)

The frontend consumes this via the `/new-slice` skill, importing the response type from `@app/shared` — the contract you wrote in step 2 is what aligns them.

## Rules

- Layered architecture is sacred: no Prisma in controllers, no Prisma outside the repository, no `req`/`res` in services, repositories never return a ViewModel.
- Zod at every boundary; no `any`, no `!`, minimal `as`.
- No comments — names carry meaning. One concern per file.
- Early return over nested `if`; make invalid states unrepresentable.
- No speculative abstraction — add the shared helper on the third real use, not the second.
- Don't scaffold roadmap features (OAuth, WebSockets, RabbitMQ, payments) preemptively — build each when a real endpoint needs it.
- Teaching repo: when introducing a new BE concept, explain the **why** (concept, tradeoff, FE analogy) to the user, not just the what.
