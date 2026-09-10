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

function tiedCountOf(facets: { count: number }[], topCount: number): number {
  return facets.filter((facet) => facet.count === topCount).length - 1;
}

function topAuthorOf(facets: QuoteAuthorFacet[]): Nullable<QuotesSummaryAuthor> {
  const [winner] = facets;
  if (winner === undefined) {
    return null;
  }

  return {
    id: winner.id,
    name: winner.name,
    quotesCount: winner.count,
    tiedCount: tiedCountOf(facets, winner.count),
  };
}

function topBookOf(facets: QuoteBookFacet[]): Nullable<QuotesSummaryBook> {
  const [winner] = facets;
  if (winner === undefined) {
    return null;
  }

  return {
    id: winner.id,
    quotesCount: winner.count,
    tiedCount: tiedCountOf(facets, winner.count),
    title: winner.title,
  };
}
