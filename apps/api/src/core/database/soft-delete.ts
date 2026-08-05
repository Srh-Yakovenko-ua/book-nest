import type { Nullable } from "@app/shared";

export const SOFT_DELETE_SCOPE = {
  active: { deletedAt: null },
  overdue: (now: Date) => ({ purgeAt: { lt: now } }),
  restored: { deletedAt: null, purgeAt: null },
  trashed: { deletedAt: { not: null } },
} as const;

export type SoftDeletable = { deletedAt: Nullable<Date>; purgeAt: Nullable<Date> };

export type Trashed<TRow extends SoftDeletable> = TRow & { deletedAt: Date; purgeAt: Date };

export function isTrashed<TRow extends SoftDeletable>(row: TRow): row is Trashed<TRow> {
  return row.deletedAt !== null && row.purgeAt !== null;
}
