import type { ReadingGoalQualifyingBook } from "./reading-goal-progress.js";

import { compareReadingGoalQualifyingBooks } from "./reading-goal-progress.js";

export type ReadingGoalCountedOrdinal = ReadingGoalQualifyingBook & {
  completedCount: number;
};

export function assignReadingGoalCountedOrdinals({
  newlyCountedBookIds,
  qualifyingBooks,
}: {
  newlyCountedBookIds: ReadonlySet<string>;
  qualifyingBooks: readonly ReadingGoalQualifyingBook[];
}): ReadingGoalCountedOrdinal[] {
  const newlyCounted = qualifyingBooks
    .filter((book) => newlyCountedBookIds.has(book.bookId))
    .sort(compareReadingGoalQualifyingBooks);
  const countedBeforeOperation = qualifyingBooks.length - newlyCounted.length;
  return newlyCounted.map((book, index) => ({
    ...book,
    completedCount: countedBeforeOperation + index + 1,
  }));
}
