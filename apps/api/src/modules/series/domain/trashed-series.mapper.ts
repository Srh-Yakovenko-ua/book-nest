import type { TrashedSeriesView } from "@app/shared";

import type { TrashedSeriesRow } from "../infrastructure/series.repository.js";

import { TRASH_RETENTION } from "../../../core/trash-retention.js";

export function toTrashedSeriesView(series: TrashedSeriesRow): TrashedSeriesView {
  return {
    booksCount: series._count.books,
    deletedAt: series.deletedAt.toISOString(),
    id: series.id,
    name: series.name,
    purgeAt: TRASH_RETENTION.purgeAfter(series.deletedAt).toISOString(),
  };
}
