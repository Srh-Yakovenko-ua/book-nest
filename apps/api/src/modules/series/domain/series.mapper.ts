import type { SeriesView } from "@app/shared";

import { SeriesStatusSchema } from "@app/shared";

import type { SeriesWithBookCount } from "../infrastructure/series.repository.js";

import { summarizeSeriesBooks, toSeriesBookPreview } from "./series-preview.js";

export function toSeriesView(series: SeriesWithBookCount): SeriesView {
  const { finishedInSeries, nextBook } = summarizeSeriesBooks(
    series.books.map(toSeriesBookPreview),
  );

  return {
    authors: series.authors.map((seriesAuthor) => ({
      id: seriesAuthor.author.id,
      name: seriesAuthor.author.name,
    })),
    booksInSeries: series._count.books,
    description: series.description,
    finishedInSeries,
    id: series.id,
    name: series.name,
    nextBook,
    status: SeriesStatusSchema.parse(series.status),
    totalBooks: series.totalBooks,
  };
}
