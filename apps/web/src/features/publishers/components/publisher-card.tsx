"use client";

import type { LibraryPublisherListItem } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { formatDate, formatNumber } from "@/lib/format";

import { publisherCountryLabel } from "../model/publisher-format";

type PublisherCardProps = {
  publisher: LibraryPublisherListItem;
};

export function PublisherCard({ publisher }: PublisherCardProps) {
  const t = useTranslations("publishers.card");
  const locale = useLocale();
  const { stats } = publisher;
  const countryLabel = publisherCountryLabel(publisher.countryCode, locale, t("geographyUnknown"));

  return (
    <article className="group/publisher-card relative flex h-full w-full flex-col gap-3.5 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-card transition-[box-shadow,border-color] duration-200 ease-out focus-within:border-accent-border focus-within:shadow-hover hover:border-accent-border hover:shadow-hover motion-reduce:transition-none">
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent text-primary"
        >
          <UiIcon name="building" size={22} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 className="font-heading text-[1.0625rem] leading-tight font-bold text-ink">
            <Link
              className="text-ink no-underline transition-colors outline-none group-hover/publisher-card:text-primary after:absolute after:inset-0 after:rounded-xl focus-visible:text-primary focus-visible:after:ring-3 focus-visible:after:ring-ring"
              href={`/publishers/${publisher.id}`}
            >
              {publisher.name}
            </Link>
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
              <UiIcon aria-hidden className="shrink-0 text-icon" name="globe" size={14} />
              {countryLabel}
            </span>
            {publisher.isCustom ? <Badge variant="secondary">{t("custom")}</Badge> : null}
          </div>
        </div>
      </div>

      <p className="flex items-baseline gap-1.5">
        <span className="font-heading text-xl font-bold text-ink tabular-nums">
          {t("books", { count: stats.booksCount })}
        </span>
        <span className="text-[0.8125rem] text-muted-foreground">{t("booksInLibrary")}</span>
      </p>

      <dl className="grid grid-cols-3 gap-2 rounded-lg bg-secondary/50 px-3 py-2">
        <CardStat label={t("read")} value={formatNumber(stats.readCount, locale)} />
        <CardStat label={t("toBuy")} value={formatNumber(stats.wantToBuyCount, locale)} />
        <CardStat label={t("series")} value={formatNumber(stats.seriesCount, locale)} />
      </dl>

      <div className="mt-auto flex flex-col gap-1.5 text-[0.8125rem]">
        {stats.averageRating === null ? (
          <p className="text-muted-foreground">{t("noRating")}</p>
        ) : (
          <p className="flex items-center gap-1.5">
            <UiIcon aria-hidden className="shrink-0 text-favorite" name="star-fill" size={15} />
            <span className="font-medium text-ink tabular-nums">
              {formatNumber(stats.averageRating, locale, {
                maximumFractionDigits: 1,
                minimumFractionDigits: 1,
              })}
            </span>
            <span className="text-muted-foreground">
              {t("ratedCount", { count: stats.ratedBooksCount })}
            </span>
          </p>
        )}
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <UiIcon aria-hidden className="shrink-0 text-icon" name="calendar" size={14} />
          {stats.lastBookAddedAt === null
            ? t("lastAddedNever")
            : t("lastAdded", { date: formatDate(stats.lastBookAddedAt, locale) })}
        </p>
      </div>
    </article>
  );
}

function CardStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="truncate text-[0.6875rem] text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold text-ink tabular-nums">{value}</dd>
    </div>
  );
}
