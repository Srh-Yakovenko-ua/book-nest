---
name: db-migrate
description: Create and apply a Prisma migration for apps/api the safe way — schema change → reviewed SQL → applied → client regenerated. Use when adding/changing a model in apps/api/prisma/schema.prisma. Guards against the rename data-loss trap and routes the SQL through migration-reviewer.
disable-model-invocation: true
---

# Prisma migration workflow (apps/api)

Stack: NestJS 11 + Prisma 7 (engineless, `@prisma/adapter-pg`) + PostgreSQL. Migrations are the source of truth (`synchronize`/`db push` are NOT used for shared data). Tracking table: `_prisma_migrations`.

Follow these steps in order. Do not skip the review.

## 1. Confirm the schema change

The model change must already be in `apps/api/prisma/schema.prisma` (a `model` block added or edited). Keep DB columns snake_case via `@map`/`@@map`; UUID PKs via `@id @default(uuid())`; timestamps via `@db.Timestamptz`. If the change isn't in the schema yet, make it first (or hand off to `backend-engineer`).

## 2. Get a migration name

Ask the user for a short snake_case name describing the change (e.g. `add_book_model`, `add_author_fk`, `rename_post_slug`). Never invent a vague name.

## 3. Decide: safe (apply directly) vs risky (review-first)

**Additive / safe** (new table, new nullable column, new index): apply directly.

```bash
pnpm --filter @app/api db:migrate --name <name>
```

This creates `apps/api/prisma/migrations/<timestamp>_<name>/migration.sql`, applies it, and regenerates the client.

**Risky** — any rename, column drop, type change, NOT NULL on an existing column, or anything on a large/populated table: create the SQL WITHOUT applying it, review, then apply.

```bash
pnpm --filter @app/api exec prisma migrate dev --create-only --name <name>
```

### The rename trap (read every time)

`prisma migrate dev` diffs the schema and emits `DROP COLUMN` + `ADD COLUMN` for a rename — that is silent data loss. For any rename, hand-edit the generated `migration.sql` to `ALTER TABLE ... RENAME COLUMN ...` before applying.

## 4. Review the generated SQL

Open `apps/api/prisma/migrations/<timestamp>_<name>/migration.sql` and **delegate it to the `migration-reviewer` agent** (classifies every DDL op SAFE / CAUTION / DESTRUCTIVE, checks online-migration safety and lock behavior on Postgres). Address anything it flags before applying. Prisma migrations are forward-only — there is no `down()`; to undo you write a new forward migration (`migrate reset` drops the whole DB and is dev-only).

## 5. Apply (if you used --create-only)

```bash
pnpm --filter @app/api db:migrate
```

## 6. Verify

- The Prisma client regenerated (`migrate dev` does this; otherwise `pnpm --filter @app/api db:generate`).
- Gates: `pnpm --filter @app/api typecheck`, `pnpm lint`, and the affected tests pass (real Postgres `booknest_test` required).
- If a new model needs FE/BE shared types, add them to `@app/shared` first.

## Production

Migrations apply in CI/release via `pnpm --filter @app/api db:migrate:deploy` (never `migrate dev` in prod). When `DATABASE_URL` points at a pgbouncer transaction pooler (e.g. Supabase Transaction Pooler), `migrate deploy` must run against the direct/session connection (`DIRECT_URL`).
