import type { Nullable } from "@app/shared";

import { compareByPartThenCreated } from "@app/shared";

export type SeriesAuthorRef = { id: string; name: string };

type CanonicalAuthorsSource = {
  authors: { author: SeriesAuthorRef }[];
  books: {
    authors: { author: SeriesAuthorRef; position: number }[];
    createdAt: Date;
    partNumber: Nullable<number>;
  }[];
};

export function resolveSeriesCanonicalAuthors(series: CanonicalAuthorsSource): SeriesAuthorRef[] {
  if (series.books.length === 0) {
    return series.authors.map(({ author }) => ({ id: author.id, name: author.name }));
  }

  const authorsById = new Map<string, SeriesAuthorRef>();
  for (const book of [...series.books].sort(compareByPartThenCreated)) {
    const orderedAuthors = [...book.authors].sort(
      (first, second) => first.position - second.position,
    );
    for (const { author } of orderedAuthors) {
      if (!authorsById.has(author.id)) {
        authorsById.set(author.id, { id: author.id, name: author.name });
      }
    }
  }

  return [...authorsById.values()];
}
