"use client";

import type { SeriesView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";
import { seriesStatuses } from "@/lib/book-status";

import { seriesProgress } from "../model/series-derive";
import { SeriesCardCover } from "./series-card-cover";

type SeriesRowProps = {
  series: SeriesView;
};

export function SeriesRow({ series }: SeriesRowProps) {
  const t = useTranslations("series");
  const progress = seriesProgress(series);
  const statusBase =
    seriesStatuses.find((entry) => entry.value === series.status) ?? seriesStatuses[2];
  const authorsLine =
    series.authors.length > 0
      ? series.authors.map((author) => author.name).join(", ")
      : t("card.authorsUnknown");
  const isEmpty = series.booksInSeries === 0;
  const coverAlt = t("card.coverAlt", { name: series.name });

  const action = ((): null | ReactNode => {
    if (progress.fullyRead) {
      return (
        <StatusBadge
          className="self-start"
          entry={{
            icon: "check-circle",
            label: t("card.readBadge"),
            tone: "success",
            value: "series-read",
          }}
        />
      );
    }
    if (series.nextBook !== null) {
      return <NextBookLine nextBook={series.nextBook} percent={progress.percent} />;
    }
    if (isEmpty) {
      return (
        <Link
          className="relative z-10 inline-flex items-center gap-1.5 self-start rounded-md text-sm font-medium text-primary no-underline transition-colors outline-none hover:text-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
          href="/books/new"
        >
          <UiIcon name="plus" size={15} />
          {t("card.addBook")}
        </Link>
      );
    }
    return null;
  })();

  return (
    <article className="group/series-row @container/series-row relative flex min-h-[9.5rem] items-stretch gap-5 rounded-xl border border-border bg-card p-3 shadow-card transition-[box-shadow,border-color] duration-200 ease-out hover:border-accent-border hover:shadow-hover motion-reduce:transition-none">
      <Link
        aria-label={coverAlt}
        className="relative z-10 shrink-0 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        href={`/series/${series.id}`}
      >
        <SeriesCardCover
          alt={coverAlt}
          booksInSeries={series.booksInSeries}
          covers={series.covers.map((cover) => ({
            id: cover.bookId,
            src: cover.cover.urls.card,
            title: cover.title,
          }))}
          name={series.name}
          showBadge={false}
          totalBooks={series.totalBooks}
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-3 @xl/series-row:flex-row @xl/series-row:flex-wrap @xl/series-row:items-start @xl/series-row:gap-x-4 @xl/series-row:gap-y-3 @3xl/series-row:flex-nowrap @3xl/series-row:items-stretch">
        <div className="flex min-w-0 flex-col gap-1 @xl/series-row:min-w-[12rem] @xl/series-row:flex-1">
          <h3 className="line-clamp-2 font-heading text-sm leading-tight font-bold text-ink">
            <Link
              className="rounded-sm text-ink no-underline transition-colors outline-none hover:text-primary focus-visible:text-primary focus-visible:underline"
              href={`/series/${series.id}`}
            >
              {series.name}
            </Link>
          </h3>
          <p className="truncate text-xs text-muted-foreground">{authorsLine}</p>
          <StatusBadge
            className="mt-0.5 self-start"
            entry={{ ...statusBase, label: t(`status.${series.status}`) }}
          />
        </div>

        <div className="hidden w-px self-stretch bg-border @3xl/series-row:block" />
        <div className="flex flex-col gap-1 @3xl/series-row:w-32">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <UiIcon aria-hidden className="shrink-0 text-icon" name="book" size={15} />
            <span className="min-w-0">
              {series.totalBooks === null
                ? t("card.books", { count: series.booksInSeries })
                : t("card.coverBadge", { added: series.booksInSeries, total: series.totalBooks })}
            </span>
          </span>
        </div>

        <div className="hidden w-px self-stretch bg-border @3xl/series-row:block" />
        <div className="flex flex-col gap-1 @3xl/series-row:w-44">
          {isEmpty ? (
            <p className="text-sm text-muted-foreground">{t("card.noBooks")}</p>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-muted-foreground">
                  {series.totalBooks === null
                    ? t("card.progressAdded", {
                        count: progress.denominator,
                        finished: progress.finished,
                      })
                    : t("card.progressWithTotal", {
                        finished: progress.finished,
                        total: series.totalBooks,
                      })}
                </span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {progress.percent}%
                </span>
              </div>
              <Progress
                aria-label={t("card.progressWithTotal", {
                  finished: progress.finished,
                  total: progress.denominator,
                })}
                className="h-1.5"
                value={progress.percent}
              />
            </>
          )}
        </div>

        <div className="hidden w-px self-stretch bg-border @3xl/series-row:block" />
        <div className="flex flex-col @3xl/series-row:min-w-[10rem] @3xl/series-row:flex-1">
          {action}
        </div>
      </div>
    </article>
  );
}

function NextBookLine({
  nextBook,
  percent,
}: {
  nextBook: NonNullable<SeriesView["nextBook"]>;
  percent: number;
}) {
  const t = useTranslations("series");
  const isStart = percent === 0;
  const label =
    nextBook.partNumber === null
      ? isStart
        ? t("card.startWith", { title: nextBook.title })
        : t("card.continueReading", { title: nextBook.title })
      : isStart
        ? t("card.startWithPart", { number: nextBook.partNumber, title: nextBook.title })
        : t("card.continueWithPart", { number: nextBook.partNumber, title: nextBook.title });

  return (
    <Link
      className="group/next relative z-10 inline-flex cursor-pointer items-start gap-1.5 self-start rounded-md text-[0.8125rem] font-medium text-primary no-underline transition-colors outline-none hover:text-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
      href={`/books/${nextBook.id}`}
    >
      <UiIcon
        aria-hidden
        className="mt-0.5 shrink-0 transition-transform group-hover/next:translate-x-0.5 group-focus-visible/next:translate-x-0.5"
        name="arrow-right"
        size={15}
      />
      <span className="line-clamp-2 min-w-0 group-hover/next:underline group-focus-visible/next:underline">
        {label}
      </span>
    </Link>
  );
}
