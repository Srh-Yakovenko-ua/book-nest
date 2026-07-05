"use client";

import type { SeriesView } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";
import { seriesStatuses } from "@/lib/book-status";

import { seriesProgress } from "../model/series-derive";

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
    <article className="group/series-card relative flex h-full cursor-pointer flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-card transition-[box-shadow,border-color] duration-200 ease-out focus-within:border-accent-border focus-within:shadow-hover hover:border-accent-border hover:shadow-hover motion-reduce:transition-none">
      <div className="flex gap-3.5">
        <SeriesCover alt={t("card.coverAlt", { name: series.name })} name={series.name} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 className="font-heading text-[1.0625rem] leading-tight font-bold text-ink">
            <Link
              className="text-ink no-underline transition-colors outline-none group-hover/series-card:text-primary after:absolute after:inset-0 focus-visible:text-primary"
              href={`/series/${series.id}`}
            >
              {series.name}
            </Link>
          </h3>
          <p className="truncate text-[0.8125rem] text-muted-foreground">{authorsLine}</p>
          <StatusBadge
            className="mt-0.5 self-start"
            entry={{ ...statusBase, label: t(`status.${series.status}`) }}
          />
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-[0.8125rem] text-foreground/85">
        <UiIcon className="shrink-0 text-icon" name="book" size={15} />
        <span>{t("card.books", { count: series.booksInSeries })}</span>
      </p>

      {isEmpty ? (
        <p className="text-sm text-muted-foreground">{t("card.noBooks")}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Progress
            aria-label={t("card.progressWithTotal", {
              finished: progress.finished,
              total: progress.denominator,
            })}
            className="h-1.5"
            value={progress.percent}
          />
          <p className="text-sm text-muted-foreground tabular-nums">
            {progress.fullyRead
              ? t("card.allRead")
              : series.totalBooks === null
                ? t("card.progressAdded", {
                    count: progress.denominator,
                    finished: progress.finished,
                  })
                : t("card.progressWithTotal", {
                    finished: progress.finished,
                    total: series.totalBooks,
                  })}
          </p>
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
      ) : (
        <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
          {t("card.view")}
          <UiIcon
            className="transition-transform duration-200 group-hover/series-card:translate-x-0.5"
            name="arrow-right"
            size={15}
          />
        </p>
      )}
    </article>
  );
}

function NextBookLine({ series }: { series: SeriesView }) {
  const t = useTranslations("series");
  const progress = seriesProgress(series);

  if (series.booksInSeries === 0) return null;
  if (progress.fullyRead) {
    return (
      <p className="flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
        <UiIcon className="shrink-0 text-icon" name="check-circle" size={15} />
        <span className="min-w-0 truncate">{t("card.nextAllRead")}</span>
      </p>
    );
  }
  if (series.nextBook === null) return null;

  return (
    <p className="flex items-center gap-1.5 text-[0.8125rem] text-foreground/85">
      <UiIcon className="shrink-0 text-icon" name="arrow-right" size={15} />
      <span className="min-w-0 truncate">
        {series.nextBook.partNumber === null
          ? t("card.next", { title: series.nextBook.title })
          : t("card.nextWithPart", {
              number: series.nextBook.partNumber,
              title: series.nextBook.title,
            })}
      </span>
    </p>
  );
}

function SeriesCover({ alt, name }: { alt: string; name: string }) {
  return (
    <div
      aria-label={alt}
      className="relative grid aspect-[3/4] w-[74px] shrink-0 place-items-center overflow-hidden rounded-md bg-accent text-accent-foreground shadow-[0_2px_8px_oklch(0.296_0.041_53/0.14)]"
      role="img"
    >
      <UiIcon
        className="absolute top-1.5 right-1.5 text-accent-foreground/40"
        name="layers"
        size={14}
      />
      <span className="font-heading text-lg font-bold text-accent-foreground/85">
        {seriesInitials(name)}
      </span>
    </div>
  );
}

function seriesInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const letters = words.slice(0, 2).map((word) => word[0] ?? "");
  return letters.join("").toUpperCase() || "?";
}
