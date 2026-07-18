import type {
  Nullable,
  QuotesSummaryAuthor,
  QuotesSummaryBook,
  QuotesSummaryView,
} from "@app/shared";

export type QuoteBookCount = {
  bookId: string;
  count: number;
  firstAuthorName: string;
  title: string;
};

export type QuotesSummaryData = {
  bookCounts: QuoteBookCount[];
  favorites: number;
  spoiler: number;
  total: number;
  withComment: number;
};

export function buildQuotesSummary(data: QuotesSummaryData): QuotesSummaryView {
  return {
    favoritesCount: data.favorites,
    spoilerCount: data.spoiler,
    topAuthor: topAuthorOf(data.bookCounts),
    topBook: topBookOf(data.bookCounts),
    totalCount: data.total,
    withCommentCount: data.withComment,
    withoutSpoilerCount: data.total - data.spoiler,
  };
}

function topAuthorOf(bookCounts: QuoteBookCount[]): Nullable<QuotesSummaryAuthor> {
  const countByAuthor = new Map<string, number>();
  for (const entry of bookCounts) {
    const name = entry.firstAuthorName.trim();
    if (name.length === 0) {
      continue;
    }
    countByAuthor.set(name, (countByAuthor.get(name) ?? 0) + entry.count);
  }

  let best: Nullable<QuotesSummaryAuthor> = null;
  for (const [name, quotesCount] of countByAuthor) {
    if (best === null || wins(quotesCount, name, best.quotesCount, best.name)) {
      best = { name, quotesCount };
    }
  }

  return best;
}

function topBookOf(bookCounts: QuoteBookCount[]): Nullable<QuotesSummaryBook> {
  let best: Nullable<QuoteBookCount> = null;
  for (const entry of bookCounts) {
    if (best === null || wins(entry.count, entry.title, best.count, best.title)) {
      best = entry;
    }
  }

  return best === null ? null : { id: best.bookId, quotesCount: best.count, title: best.title };
}

function wins(count: number, label: string, bestCount: number, bestLabel: string): boolean {
  if (count !== bestCount) {
    return count > bestCount;
  }
  return label.localeCompare(bestLabel) < 0;
}
