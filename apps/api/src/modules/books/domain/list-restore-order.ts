import type { ListBookRestorePosition } from "@app/shared";

type RestoredListOrderInput = {
  addedBookIds: string[];
  currentBookIds: string[];
  restorePositions: ListBookRestorePosition[];
};

export function buildRestoredListOrder({
  addedBookIds,
  currentBookIds,
  restorePositions,
}: RestoredListOrderInput): string[] {
  const positionByBookId = new Map(
    restorePositions.map((restorePosition) => [restorePosition.bookId, restorePosition.position]),
  );
  const restored = addedBookIds
    .flatMap((bookId) => {
      const position = positionByBookId.get(bookId);
      return position === undefined ? [] : [{ bookId, position }];
    })
    .sort((left, right) => left.position - right.position);

  const order = [...currentBookIds];
  for (const { bookId, position } of restored) {
    const insertIndex = Math.min(Math.max(position - 1, 0), order.length);
    order.splice(insertIndex, 0, bookId);
  }

  const appended = addedBookIds.filter((bookId) => !positionByBookId.has(bookId));
  return [...order, ...appended];
}
