"use client";

import type { ReactNode } from "react";

import type { SeriesSelectOption } from "../model/series-select-option";

import { SeriesSelectMeta } from "./series-select-meta";
import { SeriesSelectThumb } from "./series-select-thumb";

type SeriesSingleSelectValueProps = {
  action?: ReactNode;
  detailsId?: string;
  series: SeriesSelectOption;
};

export function SeriesSingleSelectValue({
  action,
  detailsId,
  series,
}: SeriesSingleSelectValueProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <SeriesSelectThumb series={series} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5" id={detailsId}>
        <span className="truncate text-sm font-medium text-ink">{series.name}</span>
        <SeriesSelectMeta series={series} />
      </div>
      {action}
    </div>
  );
}
