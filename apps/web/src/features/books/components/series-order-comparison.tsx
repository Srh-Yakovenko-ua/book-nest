"use client";

import type { SeriesOrderPositionView } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { toSeriesOrderComparison } from "../model/series-order-check";

type BookCellTone = "current" | "recommended" | "unchanged";

type SeriesOrderComparisonProps = {
  currentOrder: SeriesOrderPositionView[];
  recommendedOrder: SeriesOrderPositionView[];
};

const CELL_TONE = {
  current: "bg-error-soft text-destructive",
  recommended: "bg-success-soft text-success",
  unchanged: "bg-secondary text-muted-foreground",
} as const satisfies Record<BookCellTone, string>;

export function SeriesOrderComparison({
  currentOrder,
  recommendedOrder,
}: SeriesOrderComparisonProps) {
  const t = useTranslations("readingQueue.seriesOrderCheck.card");
  const rows = toSeriesOrderComparison(currentOrder, recommendedOrder);

  if (rows.every((row) => !row.changed)) return null;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground">{t("comparisonLabel")}</p>
      <ol className="flex flex-col gap-1">
        {rows.map((row) => (
          <li className="flex items-start gap-2 rounded-md px-2 py-1.5" key={row.current.bookId}>
            <span
              aria-label={
                row.queuePosition === null
                  ? t("notInQueue")
                  : t("queuePosition", { position: row.queuePosition })
              }
              className="mt-1 inline-flex min-w-9 items-center justify-center rounded-sm bg-secondary px-1.5 text-[11px] font-medium text-muted-foreground tabular-nums"
            >
              <span aria-hidden>{row.queuePosition === null ? "—" : `#${row.queuePosition}`}</span>
            </span>
            {row.changed ? (
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <BookCell book={row.current} tone="current" />
                <div className="flex min-w-0 items-center gap-1.5">
                  <UiIcon
                    aria-label={t("changesTo")}
                    className="shrink-0 text-muted-foreground"
                    name="arrow-right"
                    size={14}
                  />
                  <BookCell book={row.recommended} tone="recommended" />
                </div>
              </div>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <BookCell book={row.current} tone="unchanged" />
                <UiIcon
                  aria-label={t("staysInPlace")}
                  className="shrink-0 text-success"
                  name="check"
                  size={14}
                />
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function BookCell({ book, tone }: { book: SeriesOrderPositionView; tone: BookCellTone }) {
  const t = useTranslations("readingQueue.seriesOrderCheck.card");
  const seriesLabel =
    book.seriesPosition === null
      ? t("seriesPositionUnknown")
      : t("seriesPosition", { position: book.seriesPosition });

  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-baseline gap-1.5 rounded-sm px-2 py-1 text-xs",
        CELL_TONE[tone],
      )}
    >
      <span className="shrink-0 font-medium tabular-nums">{seriesLabel}</span>
      <span aria-hidden className="shrink-0 opacity-60">
        ·
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="min-w-0 truncate">{book.title}</span>
        </TooltipTrigger>
        <TooltipContent>{book.title}</TooltipContent>
      </Tooltip>
    </div>
  );
}
