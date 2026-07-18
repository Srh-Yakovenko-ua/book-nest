import type { BookView, DedicationsSummaryView } from "@app/shared";

import { makeBookView } from "@/features/books/components/book-details.fixtures";

export function makeDedicationBook(overrides: Partial<BookView> = {}): BookView {
  return makeBookView({
    dedication: "Моїй мамі, яка навчила мене мріяти.",
    isFavorite: false,
    isFavoriteDedication: false,
    ...overrides,
  });
}

export function makeDedicationsSummary(
  overrides: Partial<DedicationsSummaryView> = {},
): DedicationsSummaryView {
  return {
    availableGenres: ["fantasy"],
    favoriteCount: 2,
    finishedCount: 5,
    topAuthor: { count: 3, name: "Сара Джіо" },
    topGenre: { count: 4, genre: "fantasy" },
    totalCount: 7,
    unfinishedCount: 2,
    ...overrides,
  };
}
