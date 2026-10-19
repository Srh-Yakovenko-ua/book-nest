---
name: db-migrate
description: Create and apply a Prisma migration for apps/api the safe way — schema change → reviewed SQL → stripped DROP INDEX lines → applied → client regenerated. Use whenever apps/api/prisma/schema.prisma gains or changes a model, field, enum or index, and when the user says "миграция", "migration", "поменяй схему", "добавь поле", "alter table". Guards the rename data-loss trap and the raw-SQL-index strip trap, and routes the SQL through migration-reviewer.
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

Some indexes live in hand-written SQL inside their own past migrations because Prisma cannot express them in a `model` (trigram GIN, and partial indexes with a `WHERE` predicate). They exist in the database but not in `schema.prisma`. The single source of truth for which ones exist is `apps/api/src/core/database/raw-sql-indexes.test.ts`, which asserts each one with its predicate; read it there rather than trusting a copied list, because copies here have gone stale before (an earlier list named an index that was later deleted).

Only the two trigram GIN indexes, `authors_search_text_trgm_idx` and `publishers_search_text_trgm_idx`, come back as spurious `DROP INDEX` lines in a generated migration: Prisma's differ sees a plain index it did not declare, but cannot represent a `WHERE` predicate at all, so the partial ones are invisible to it. Dropping the GIN pair degrades cross-locale search to a sequential scan.

Still read every `DROP INDEX` line in the generated `migration.sql` and strip any that no task asked for, before `db:migrate:deploy`. A dropped partial-unique index silently loses a one-active invariant, and the test only turns red in CI after the damage is applied. A `DROP INDEX` on a partial index is legitimate exactly once, in the migration that converts a plain index into that partial one. This is exactly why even an "additive" migration is never a blind apply.

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
- Gates: `/check` is green, and the tests that touch the changed tables are listed as `CI:` lines. A schema change makes CI run the full suite, so it reaches `dev` through a PR.
- If a new model needs FE/BE shared types, add them to `@app/shared` first.

## Production

Prod never runs `migrate dev`. The API container applies pending migrations itself on boot: `apps/api/docker-entrypoint.sh` runs `prisma migrate deploy` against the live env DB before the app starts, then seeds, then boots. A failed migration makes the container unhealthy and the deploy rolls back the image (but not the already-applied migrations), so when migrations are pending, pre-flight them against a copy of prod data first (`pnpm db:copy:prod`) before promoting.
