import type { Nullable } from "@app/shared";

export const SOFT_DELETE_SCOPE = {
  active: { deletedAt: null },
  trashed: { deletedAt: { not: null } },
} as const;

export type Trashed<TRow extends { deletedAt: Nullable<Date> }> = TRow & { deletedAt: Date };

export function isTrashed<TRow extends { deletedAt: Nullable<Date> }>(
  row: TRow,
): row is Trashed<TRow> {
  return row.deletedAt !== null;
}
