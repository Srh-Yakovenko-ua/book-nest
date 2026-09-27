"use client";

import type { LibraryPublisherListItem } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";

import { publisherAddedDateLabel, publisherCountryLabel } from "../model/publisher-format";

type PublisherCardProps = {
  publisher: LibraryPublisherListItem;
};

export function PublisherCard({ publisher }: PublisherCardProps) {
  const t = useTranslations("publishers.card");
  const locale = useLocale();
  const { stats } = publisher;
  const countryLabel = publisherCountryLabel(publisher.countryCode, locale, t("geographyUnknown"));

  return (
    <article className="group/publisher-card relative flex h-full w-full flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-card transition-[box-shadow,border-color] duration-200 ease-out focus-within:border-accent-border focus-within:shadow-hover hover:border-accent-border hover:shadow-hover motion-reduce:transition-none">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-primary"
        >
          <UiIcon name="building" size={20} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="line-clamp-2 min-h-[2lh] font-heading text-base leading-tight font-bold break-words text-ink">
            <Link
              className="text-ink no-underline transition-colors outline-none group-hover/publisher-card:text-primary after:absolute after:inset-0 after:rounded-xl focus-visible:text-primary focus-visible:after:ring-3 focus-visible:after:ring-ring"
              href={`/publishers/${publisher.id}`}
            >
              {publisher.name}
            </Link>
          </h3>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
              <UiIcon aria-hidden className="shrink-0 text-icon" name="globe" size={14} />
              {countryLabel}
            </span>
            {publisher.isCustom ? <Badge variant="secondary">{t("custom")}</Badge> : null}
          </div>
        </div>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-heading text-xl leading-tight font-bold text-ink tabular-nums">
            {t("books", { count: stats.booksCount })}
          </p>
          <p className="text-xs text-muted-foreground">{t("booksInLibrary")}</p>
        </div>
        {stats.averageRating === null ? (
          <p className="shrink-0 pt-1 text-xs text-muted-foreground">{t("noRating")}</p>
        ) : (
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <p className="inline-flex items-center gap-1 font-heading text-xl leading-tight font-bold text-ink tabular-nums">
              <UiIcon aria-hidden className="shrink-0 text-favorite" name="star-fill" size={16} />
              <span>
                {formatNumber(stats.averageRating, locale, {
                  maximumFractionDigits: 1,
                  minimumFractionDigits: 1,
                })}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {t("ratedCount", { count: stats.ratedBooksCount })}
            </p>
          </div>
        )}
      </div>

      <dl className="grid grid-cols-3 divide-x divide-border/60 border-y border-border/60 py-2">
        <CardStat label={t("read")} value={formatNumber(stats.readCount, locale)} />
        <CardStat label={t("toBuy")} value={formatNumber(stats.wantToBuyCount, locale)} />
        <CardStat label={t("series")} value={formatNumber(stats.seriesCount, locale)} />
      </dl>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <UiIcon aria-hidden className="shrink-0 text-icon" name="calendar" size={14} />
        {stats.lastBookAddedAt === null
          ? t("lastAddedNever")
          : t("lastAdded", { date: publisherAddedDateLabel(stats.lastBookAddedAt, locale) })}
      </p>
    </article>
  );
}

function CardStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col justify-between gap-0.5 px-2 first:pl-0 last:pr-0">
      <dt className="line-clamp-2 text-[0.6875rem] leading-tight break-words text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm font-semibold text-ink tabular-nums">{value}</dd>
    </div>
  );
}
