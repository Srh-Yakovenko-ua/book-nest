import type { TrashedSeriesView } from "@app/shared";

import type { TrashedSeriesRow } from "../infrastructure/series.repository.js";

export function toTrashedSeriesView(series: TrashedSeriesRow): TrashedSeriesView {
  return {
    booksCount: series._count.books,
    deletedAt: series.deletedAt.toISOString(),
    id: series.id,
    name: series.name,
    purgeAt: series.purgeAt.toISOString(),
  };
}
