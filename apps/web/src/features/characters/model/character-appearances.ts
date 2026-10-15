import type { BookCharacterView, Nullable } from "@app/shared";

export const APPEARANCE_LIST = {
  collapsedCount: 5,
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
  return [...appearances].sort(compareAppearances);
}

function compareAppearances(left: BookCharacterView, right: BookCharacterView): number {
  const leftSeries = left.book.series;
  const rightSeries = right.book.series;
  if (leftSeries === null || rightSeries === null) {
    if (leftSeries !== rightSeries) return leftSeries === null ? 1 : -1;
    return compareBooks(left, right);
  }
  if (leftSeries.id !== rightSeries.id) {
    return (
      leftSeries.name.localeCompare(rightSeries.name) || leftSeries.id.localeCompare(rightSeries.id)
    );
  }
  return (
    comparePartNumbers(leftSeries.partNumber, rightSeries.partNumber) || compareBooks(left, right)
  );
}

function compareBooks(left: BookCharacterView, right: BookCharacterView): number {
  return (
    left.book.title.localeCompare(right.book.title) || left.book.id.localeCompare(right.book.id)
  );
}

function comparePartNumbers(left: Nullable<number>, right: Nullable<number>): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
}
