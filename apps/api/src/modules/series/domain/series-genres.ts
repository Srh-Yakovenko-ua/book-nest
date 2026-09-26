import { BOOK_GENRES_MAX } from "@app/shared";

import { UKRAINIAN_COLLATION } from "../../../core/ukrainian-collation.js";

export type SeriesGenreBookRow = {
  genres: string[];
};

type SeriesGenreCount = {
  bookCount: number;
  genre: string;
};

export function summarizeSeriesGenres(books: readonly SeriesGenreBookRow[]): string[] {
  const countsByGenre = new Map<string, SeriesGenreCount>();

  for (const book of books) {
    for (const genre of new Set(book.genres)) {
      const counted = countsByGenre.get(genre);
      if (counted === undefined) {
        countsByGenre.set(genre, { bookCount: 1, genre });
        continue;
      }

      counted.bookCount += 1;
    }
  }

  return [...countsByGenre.values()]
    .filter((counted) => isHeldByMajority({ bookCount: counted.bookCount, total: books.length }))
    .sort(compareByBookCountThenGenre)
    .slice(0, BOOK_GENRES_MAX)
    .map((counted) => counted.genre);
}

function compareByBookCountThenGenre(first: SeriesGenreCount, second: SeriesGenreCount): number {
  if (first.bookCount !== second.bookCount) {
    return second.bookCount - first.bookCount;
  }

  return UKRAINIAN_COLLATION.compare(first.genre, second.genre);
}

function isHeldByMajority({ bookCount, total }: { bookCount: number; total: number }): boolean {
  return bookCount * 2 > total;
}
