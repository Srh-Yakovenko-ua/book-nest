import type { Nullable } from "@app/shared";

import { compareText, SORT_ORDER } from "./compare-text.js";

export type ActiveBookOrderKey = {
  id: string;
  key: Nullable<string>;
};

export type ActiveBooksPageSlice<TBook extends ActiveBookOrderKey> = {
  items: TBook[];
  nextCursor: Nullable<ActiveBookOrderKey>;
};

export function compareActiveBooks(left: ActiveBookOrderKey, right: ActiveBookOrderKey): number {
  if (left.key !== right.key) {
    if (left.key === null) {
      return SORT_ORDER.after;
    }
    if (right.key === null) {
      return SORT_ORDER.before;
    }
    return compareText(right.key, left.key);
  }
  return compareText(left.id, right.id);
}

export function resolveActiveBookKey({
  cycleStartedAt,
  lastProgressAt,
}: {
  cycleStartedAt: Nullable<string>;
  lastProgressAt: Nullable<string>;
}): Nullable<string> {
  return lastProgressAt ?? cycleStartedAt;
}

export function sortActiveBooks<TBook extends ActiveBookOrderKey>(
  books: readonly TBook[],
): TBook[] {
  return [...books].sort(compareActiveBooks);
}

export function takeActiveBooksPage<TBook extends ActiveBookOrderKey>({
  after,
  ordered,
  pageSize,
}: {
  after: Nullable<ActiveBookOrderKey>;
  ordered: readonly TBook[];
  pageSize: number;
}): ActiveBooksPageSlice<TBook> {
  const remaining =
    after === null ? ordered : ordered.filter((book) => compareActiveBooks(book, after) > 0);
  const items = remaining.slice(0, pageSize);
  const last = items.at(-1);

  if (last === undefined || remaining.length <= items.length) {
    return { items, nextCursor: null };
  }
  return { items, nextCursor: { id: last.id, key: last.key } };
}
