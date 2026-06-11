import type { SeriesView } from "@app/shared";

import { SeriesStatusSchema } from "@app/shared";

import type { SeriesModel } from "../../../generated/prisma/models.js";

export function toSeriesView(series: SeriesModel): SeriesView {
  return {
    description: series.description,
    id: series.id,
    name: series.name,
    status: SeriesStatusSchema.parse(series.status),
    totalBooks: series.totalBooks,
  };
}
