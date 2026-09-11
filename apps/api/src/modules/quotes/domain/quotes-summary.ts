import type {
  Nullable,
  QuoteAuthorFacet,
  QuoteBookFacet,
  QuotesSummaryAuthor,
  QuotesSummaryBook,
  QuotesSummaryView,
} from "@app/shared";

import type { QuotesSummaryData } from "../infrastructure/quotes.repository.js";

import { toAuthorFacets, toBookFacets } from "./quotes-facets.js";

export function buildQuotesSummary(data: QuotesSummaryData): QuotesSummaryView {
  const quotedBooksCount = data.bookCounts.length;

  return {
    averageQuotesPerQuotedBook: quotedBooksCount === 0 ? null : data.total / quotedBooksCount,
    favoritesCount: data.favorites,
    quotedBooksCount,
    spoilerCount: data.spoiler,
    topAuthor: topAuthorOf(
      toAuthorFacets({ bookCounts: data.bookCounts, links: data.authorLinks }),
    ),
    topBook: topBookOf(toBookFacets(data.bookCounts)),
    totalCount: data.total,
    withCommentCount: data.withComment,
    withoutSpoilerCount: data.total - data.spoiler,
  };
}

function leadersOf<TFacet extends { count: number }>(sortedFacets: TFacet[]): TFacet[] {
  const [best] = sortedFacets;
  if (best === undefined) {
    return [];
  }

  return sortedFacets.filter((facet) => facet.count === best.count);
}

function topAuthorOf(facets: QuoteAuthorFacet[]): Nullable<QuotesSummaryAuthor> {
  const leaders = leadersOf(facets);
  const [leader] = leaders;
  if (leader === undefined) {
    return null;
  }

  if (leaders.length > 1) {
    return { leadersCount: leaders.length, name: null, quotesCount: leader.count };
  }

  return { leadersCount: 1, name: leader.name, quotesCount: leader.count };
}

function topBookOf(facets: QuoteBookFacet[]): Nullable<QuotesSummaryBook> {
  const leaders = leadersOf(facets);
  const [leader] = leaders;
  if (leader === undefined) {
    return null;
  }

  if (leaders.length > 1) {
    return { leadersCount: leaders.length, quotesCount: leader.count, title: null };
  }

  return { leadersCount: 1, quotesCount: leader.count, title: leader.title };
}
