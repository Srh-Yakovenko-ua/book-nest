import type { SeriesView } from "@app/shared";

import { SeriesStatusSchema } from "@app/shared";

import type { SeriesWithBookCount } from "../infrastructure/series.repository.js";

export function toSeriesView(series: SeriesWithBookCount): SeriesView {
  return {
    booksInSeries: series._count.books,
    description: series.description,
    finishedInSeries: series.books.length,
    id: series.id,
    name: series.name,
    status: SeriesStatusSchema.parse(series.status),
    totalBooks: series.totalBooks,
  };
}
