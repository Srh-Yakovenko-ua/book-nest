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

## 3. Create the review-only migration

`db:migrate --name` is **always create-only**. It runs `prisma migrate dev --create-only` under the hood: it writes the SQL file and does NOT apply it, does NOT touch the database, does NOT regenerate the client. (Bare `db:migrate` with no name aborts on purpose. The name is required because a non-TTY shell hangs forever on Prisma's interactive name prompt.)

```bash
pnpm --filter @app/api db:migrate --name <name>
```

This writes `apps/api/prisma/migrations/<timestamp>_<name>/migration.sql` for review. Nothing is live yet.

Additive changes (new table, new nullable column, new index) go through the exact same create → review → apply flow as risky ones (rename, column drop, type change, NOT NULL on an existing column, anything on a large/populated table). "Additive vs risky" only changes how hard you scrutinise the SQL in step 4, never the commands. There is no "apply directly" shortcut.

### The rename trap (read every time)

`prisma migrate dev` diffs the schema and emits `DROP COLUMN` + `ADD COLUMN` for a rename, which is silent data loss. For any rename, hand-edit the generated `migration.sql` to `ALTER TABLE ... RENAME COLUMN ...` before applying.

### The DROP-INDEX strip trap (read every time)

Four indexes live in hand-written SQL inside their own past migrations because Prisma cannot express them in a `model`. They exist in the database but not in `schema.prisma`, so every newly generated migration emits a spurious `DROP INDEX` for them:

- `authors_search_text_trgm_idx`, `publishers_search_text_trgm_idx`: trigram GIN (`gin_trgm_ops`) powering cross-locale author/publisher search. Dropping them degrades search to a sequential scan.
- `book_deliveries_active_book_idx`, `book_loans_active_book_idx`: partial-unique indexes enforcing one active delivery and one active loan per book. Dropping them silently loses the invariant.

Before applying ANY migration, open the generated `migration.sql` and delete every `DROP INDEX` line targeting one of these four. This is exactly why even an "additive" migration is never a blind apply.

## 4. Review the generated SQL

Open `apps/api/prisma/migrations/<timestamp>_<name>/migration.sql` and **delegate it to the `migration-reviewer` agent** (classifies every DDL op SAFE / CAUTION / DESTRUCTIVE, checks online-migration safety and lock behavior on Postgres). Address anything it flags, and confirm both traps above are handled, before applying. Prisma migrations are forward-only: there is no `down()`; to undo you write a new forward migration (`migrate reset` drops the whole DB and is dev-only).

## 5. Apply

```bash
pnpm --filter @app/api db:migrate:deploy
```

`migrate deploy` is non-interactive and advisory-locked. It applies every pending migration but does NOT regenerate the client.

## 6. Verify

- Regenerate the Prisma client (neither `--create-only` nor `migrate deploy` does this): `pnpm --filter @app/api db:generate`.
- Confirm the DB is in sync: `pnpm --filter @app/api db:migrate:status` → "Database schema is up to date".
- Gates: `pnpm --filter @app/api typecheck`, `pnpm lint`, and the affected tests pass (real Postgres `booknest_test` required).
- If a new model needs FE/BE shared types, add them to `@app/shared` first.

## Production

Prod never runs `migrate dev`. The API container applies pending migrations itself on boot: `apps/api/docker-entrypoint.sh` runs `prisma migrate deploy` against the live env DB before the app starts, then seeds, then boots. A failed migration makes the container unhealthy and the deploy rolls back the image (but not the already-applied migrations), so when migrations are pending, pre-flight them against a copy of prod data first (`pnpm db:copy:prod`) before promoting.
