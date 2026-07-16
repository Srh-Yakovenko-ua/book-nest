import type { BookView, DedicationsSummaryView, Nullable } from "@app/shared";

export function computeDedicationsSummary({
  books,
}: {
  books: BookView[];
}): DedicationsSummaryView {
  const finishedCount = books.filter((book) => book.readingStatus === "finished").length;

  return {
    favoriteCount: books.filter((book) => book.isFavoriteDedication).length,
    finishedCount,
    topAuthor: pickTopAuthor(books),
    topGenre: pickTopGenre(books),
    totalCount: books.length,
    unfinishedCount: books.length - finishedCount,
  };
}

function pickMostFrequent(labels: string[]): Nullable<{ count: number; label: string }> {
  const counts = new Map<string, number>();
  for (const label of labels) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  let best: Nullable<{ count: number; label: string }> = null;
  for (const [label, count] of counts) {
    if (best === null || count > best.count || (count === best.count && label < best.label)) {
      best = { count, label };
    }
  }
  return best;
}

function pickTopAuthor(books: BookView[]): DedicationsSummaryView["topAuthor"] {
  const top = pickMostFrequent(books.flatMap((book) => book.authors.map((author) => author.name)));
  return top === null ? null : { count: top.count, name: top.label };
}

function pickTopGenre(books: BookView[]): DedicationsSummaryView["topGenre"] {
  const top = pickMostFrequent(books.flatMap((book) => book.genres));
  return top === null ? null : { count: top.count, genre: top.label };
}
