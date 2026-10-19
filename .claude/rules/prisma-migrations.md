---
paths:
  - "apps/api/prisma/**"
---

# Prisma schema and migrations

**Two steps, never one.** `pnpm --filter @app/api db:migrate --name <snake_case>` creates a review-only migration (`migrate dev --create-only`). `--name` is required: bare `prisma migrate dev` blocks forever on the interactive name prompt in a non-TTY shell. Review the `migration.sql` (`migration-reviewer`, the rename trap, the strip-trap below), then `pnpm --filter @app/api db:migrate:deploy`. Committed migrations are history that prod already applied; the file guard refuses edits to them, so a fix is a new migration.

**Raw-SQL-index strip-trap.** Sixteen indexes live in hand-written SQL inside their migrations because Prisma can't express them in a `model`. They exist in the DB but not in `schema.prisma`, and `apps/api/src/core/database/raw-sql-indexes.test.ts` asserts all sixteen with their predicates, so a forgotten strip turns CI red instead of silently dropping an invariant.

- Trigram GIN `authors_search_text_trgm_idx` + `publishers_search_text_trgm_idx` (`gin_trgm_ops`, cross-locale search).
- Partial-unique `book_order_items_active_book_idx` + `book_loans_active_book_idx`: one active order item / one active loan per book.
- Partial-unique `delivery_services_global_provider_key_idx` (`WHERE user_id IS NULL AND provider_key IS NOT NULL`): one global service per provider key. A plain composite unique can't express it, since Postgres treats every NULL `user_id` as distinct.
- Partial `books_user_queue_position_idx` (`WHERE queue_position IS NOT NULL AND deleted_at IS NULL`): reading-queue reads, shifts and resequences.
- Partial-unique `books_series_id_part_number_key` (`WHERE deleted_at IS NULL`): a trashed book stops holding its series slot. Keep that exact name; `book-relations-resolver` maps P2002 on it to the friendly part-number conflict error.
- Partial-unique `series_user_id_normalized_name_key` + `book_lists_user_id_normalized_name_key` + `book_timelines_book_id_name_lower_idx` (`WHERE deleted_at IS NULL`): a trashed series/list/timeline releases its name. Series and list creation take an advisory lock instead of relying on upsert.
- Partial-unique `reading_goals_active_list_idx` (`WHERE archived_at IS NULL AND list_id IS NOT NULL`): at most one open reading goal per list; archiving releases the slot, goals with no list are uncovered.
- Partial-unique `book_budgets_active_currency_idx` (`WHERE valid_to_month IS NULL`): one open budget per currency.
- Partial-unique `book_reading_cycles_active_book_idx` (`WHERE state = 'active'`): at most one read-through in progress per book. The DB half of the reading-cycle invariant; the other half is the per-book advisory lock in `ReadingLifecycleCoordinator`.
- Species catalog: `species_system_key_key` + `species_system_normalized_name_key` (`WHERE user_id IS NULL`, one system species per key and per normalized name) + `species_user_id_normalized_name_key` (`WHERE user_id IS NOT NULL`, one custom species per name per owner).

**In practice only the two trigram GIN indexes come back as a spurious `DROP INDEX`.** Prisma's differ sees a plain index it did not declare but cannot represent a `WHERE` predicate at all, so the fourteen partial ones are invisible to it and never drop candidates. Do not let that shrink the check: read every `DROP INDEX` line in a generated migration and strip the ones no task asked for **before** `db:migrate:deploy`, or search degrades to a seq scan and the one-active invariants are silently lost. A `DROP INDEX` on a partial index is legitimate exactly once, in the migration that converts a plain index into that partial one.
