import type { BookCharacterView, Nullable } from "@app/shared";

import { compareCharacterBooks } from "@app/shared";

export const APPEARANCE_LIST = {
  collapsedCount: 4,
} as const;

type AppearanceListWindow = {
  canToggle: boolean;
  pinned: Nullable<BookCharacterView>;
  rows: BookCharacterView[];
};

export function appearanceListWindow({
  activeBookId,
  appearances,
  expanded,
}: {
  activeBookId: Nullable<string>;
  appearances: readonly BookCharacterView[];
  expanded: boolean;
}): AppearanceListWindow {
  const canToggle = appearances.length > APPEARANCE_LIST.collapsedCount;
  if (expanded || !canToggle) return { canToggle, pinned: null, rows: [...appearances] };

  const rows = appearances.slice(0, APPEARANCE_LIST.collapsedCount);
  const activeIsShown = rows.some((appearance) => appearance.bookId === activeBookId);
  const pinned = activeIsShown
    ? null
    : (appearances.find((appearance) => appearance.bookId === activeBookId) ?? null);
  return { canToggle, pinned, rows };
}

export function sortAppearances(appearances: readonly BookCharacterView[]): BookCharacterView[] {
  return [...appearances].sort((left, right) => compareCharacterBooks(left.book, right.book));
}
