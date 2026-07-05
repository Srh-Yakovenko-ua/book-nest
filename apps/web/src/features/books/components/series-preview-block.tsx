"use client";

import type { BookView, SeriesView } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";
import { seriesStatuses } from "@/lib/book-status";

type SeriesPreviewBlockProps = {
  book: BookView;
};

type SeriesStateKey =
  | "finished"
  | "isNext"
  | "reading"
  | "rereading"
  | "seriesFinished"
  | "unreadEarlier";

export function SeriesPreviewBlock({ book }: SeriesPreviewBlockProps) {
  const t = useTranslations("books.details.series");
  const { series } = book;
  if (series === null) return null;

  const statusBase = seriesStatuses.find((entry) => entry.value === series.status);
  const denominator = series.totalBooks ?? series.booksInSeries;
  const hasProgress = series.booksInSeries > 0;
  const percent =
    hasProgress && denominator > 0 ? Math.round((series.finishedInSeries / denominator) * 100) : 0;

  const stateKey = resolveStateKey(book, series);
  const nextBook =
    series.nextBook !== null && series.nextBook.id !== book.id ? series.nextBook : null;

  return (
    <Card className="shadow-detail-block">
      <CardHeader>
        <CardTitle asChild>
          <h2>{t("title")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Link
            className="font-heading text-base leading-snug font-medium text-ink no-underline transition-colors outline-none hover:text-primary hover:underline focus-visible:text-primary"
            href={`/series/${series.id}`}
          >
            {series.name}
          </Link>
          {statusBase === undefined ? null : (
            <StatusBadge
              className="self-start"
              entry={{ ...statusBase, label: t(`statusLabels.${series.status}`) }}
            />
          )}
        </div>

        <PartLine book={book} series={series} />

        {hasProgress ? (
          <div className="flex flex-col gap-1.5">
            <Progress aria-label={t("progressLabel")} className="h-1.5" value={percent} />
            <p className="text-sm text-muted-foreground tabular-nums">
              {series.totalBooks === null
                ? t("progressAdded", {
                    count: denominator,
                    finished: series.finishedInSeries,
                    percent,
                  })
                : t("progressWithTotal", {
                    finished: series.finishedInSeries,
                    percent,
                    total: series.totalBooks,
                  })}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("progressUnavailable")}</p>
        )}

        {stateKey === null ? null : (
          <p className="text-sm font-medium text-foreground/90">{t(`state.${stateKey}`)}</p>
        )}

        {nextBook === null ? null : (
          <Link
            className="group flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2.5 text-sm text-foreground/90 transition-colors outline-none hover:border-primary/40 hover:bg-secondary/70 focus-visible:ring-[3px] focus-visible:ring-ring/50"
            href={`/books/${nextBook.id}`}
          >
            <UiIcon className="shrink-0 text-muted-foreground" name="arrow-right" size={16} />
            <span className="min-w-0 truncate font-medium">
              {nextBook.partNumber === null
                ? t("next", { title: nextBook.title })
                : t("nextWithPart", { number: nextBook.partNumber, title: nextBook.title })}
            </span>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

function PartLine({ book, series }: { book: BookView; series: SeriesView }) {
  const t = useTranslations("books.details.series");

  if (book.partNumber === null) {
    return <p className="text-sm text-muted-foreground">{t("partUnknown")}</p>;
  }

  return (
    <p className="text-sm text-foreground/90">
      {series.totalBooks === null
        ? t("partAdded", { count: series.booksInSeries, number: book.partNumber })
        : t("partWithTotal", { number: book.partNumber, total: series.totalBooks })}
    </p>
  );
}

function resolveStateKey(book: BookView, series: SeriesView): null | SeriesStateKey {
  if (book.readingStatus === "finished") return "finished";
  if (book.readingStatus === "reading") return "reading";
  if (book.readingStatus === "rereading") return "rereading";
  if (series.nextBook?.id === book.id) return "isNext";
  if (book.hasUnreadEarlierSeriesParts === true) return "unreadEarlier";
  if (series.finishedInSeries === series.booksInSeries && series.booksInSeries > 0) {
    return "seriesFinished";
  }
  return null;
}
