"use client";

import type { SeriesView } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";
import { seriesStatuses } from "@/lib/book-status";

import { seriesProgress } from "../model/series-derive";
import { SeriesCardCover } from "./series-card-cover";

type SeriesCardProps = {
  series: SeriesView;
};

export function SeriesCard({ series }: SeriesCardProps) {
  const t = useTranslations("series");
  const progress = seriesProgress(series);
  const statusBase =
    seriesStatuses.find((entry) => entry.value === series.status) ?? seriesStatuses[2];
  const authorsLine =
    series.authors.length > 0
      ? series.authors.map((author) => author.name).join(", ")
      : t("card.authorsUnknown");
  const isEmpty = series.booksInSeries === 0;

  return (
    <article className="relative flex h-full flex-col gap-2.5 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-card transition-[box-shadow,border-color] duration-200 ease-out focus-within:border-accent-border focus-within:shadow-hover hover:border-accent-border hover:shadow-hover motion-reduce:transition-none max-sm:gap-2 max-sm:p-3">
      <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3.5 max-sm:grid-cols-[5.25rem_minmax(0,1fr)] max-sm:gap-3">
        <Link
          aria-label={t("card.coverAlt", { name: series.name })}
          className="block cursor-pointer rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          href={`/series/${series.id}`}
        >
          <SeriesCardCover
            alt={t("card.coverAlt", { name: series.name })}
            booksInSeries={series.booksInSeries}
            covers={series.covers.map((cover) => ({
              id: cover.bookId,
              src: cover.cover.urls.card,
              title: cover.title,
            }))}
            mobileCompact
            name={series.name}
            totalBooks={series.totalBooks}
          />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 className="line-clamp-4 font-heading text-[1.0625rem] leading-tight font-bold text-ink max-sm:line-clamp-3 max-sm:text-sm">
            <Link
              className="cursor-pointer rounded-sm text-ink no-underline transition-colors outline-none hover:text-primary focus-visible:text-primary focus-visible:underline"
              href={`/series/${series.id}`}
            >
              {series.name}
            </Link>
          </h3>
          <p className="line-clamp-2 text-[0.8125rem] text-muted-foreground max-sm:text-xs">
            {authorsLine}
          </p>
          <StatusBadge
            className="mt-0.5 self-start max-sm:h-5 max-sm:gap-1 max-sm:px-1.5 max-sm:text-[0.625rem] max-sm:[&>svg]:size-3"
            entry={{ ...statusBase, label: t(`status.${series.status}`) }}
          />
        </div>
      </div>

      {isEmpty ? (
        <p className="text-sm text-muted-foreground">{t("card.noBooks")}</p>
      ) : progress.fullyRead ? (
        <StatusBadge
          className="self-start"
          entry={{
            icon: "check-circle",
            label: t("card.readBadge"),
            tone: "success",
            value: "series-read",
          }}
        />
      ) : (
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 text-sm max-sm:text-xs">
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
            <span className="shrink-0 text-muted-foreground tabular-nums">{progress.percent}%</span>
          </div>
          <Progress
            aria-label={t("card.progressWithTotal", {
              finished: progress.finished,
              total: progress.denominator,
            })}
            className="h-1.5"
            value={progress.percent}
          />
        </div>
      )}

      <NextBookLine series={series} />

      {isEmpty ? (
        <Link
          className="relative z-10 mt-1 inline-flex items-center gap-1.5 self-start rounded-md text-sm font-medium text-primary no-underline transition-colors outline-none hover:text-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
          href="/books/new"
        >
          <UiIcon name="plus" size={15} />
          {t("card.addBook")}
        </Link>
      ) : null}
    </article>
  );
}

function NextBookLine({ series }: { series: SeriesView }) {
  const t = useTranslations("series");
  const progress = seriesProgress(series);

  if (series.booksInSeries === 0) return null;
  if (progress.fullyRead) return null;
  if (series.nextBook === null) return null;

  const nextBook = series.nextBook;
  const isStart = progress.percent === 0;
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
      className="group/next inline-flex cursor-pointer items-start gap-1.5 self-start rounded-md text-[0.8125rem] font-medium text-primary no-underline transition-colors outline-none hover:text-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
