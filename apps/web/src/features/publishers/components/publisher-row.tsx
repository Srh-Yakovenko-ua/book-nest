"use client";

import type { LibraryPublisherListItem } from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { formatDate, formatNumber } from "@/lib/format";

import { publisherCountryLabel } from "../model/publisher-format";

type PublisherRowProps = {
  publisher: LibraryPublisherListItem;
};

export function PublisherRow({ publisher }: PublisherRowProps) {
  const t = useTranslations("publishers.row");
  const tCard = useTranslations("publishers.card");
  const locale = useLocale();
  const { stats } = publisher;
  const countryLabel = publisherCountryLabel(
    publisher.countryCode,
    locale,
    tCard("geographyUnknown"),
  );

  return (
    <article className="group/publisher-row relative flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-card transition-[box-shadow,border-color] duration-200 ease-out focus-within:border-accent-border focus-within:shadow-hover hover:border-accent-border hover:shadow-hover motion-reduce:transition-none md:flex-row md:items-center md:gap-6">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-primary"
        >
          <UiIcon name="building" size={20} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="font-heading text-[0.9375rem] leading-tight font-bold text-ink">
            <Link
              className="text-ink no-underline transition-colors outline-none group-hover/publisher-row:text-primary after:absolute after:inset-0 focus-visible:text-primary"
              href={`/publishers/${publisher.id}`}
            >
              {publisher.name}
            </Link>
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-[0.8125rem] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <UiIcon aria-hidden className="shrink-0 text-icon" name="globe" size={13} />
              {countryLabel}
            </span>
            <Badge variant={publisher.isCustom ? "secondary" : "outline"}>
              {publisher.isCustom ? t("sourceCustom") : t("sourceGlobal")}
            </Badge>
          </div>
        </div>
      </div>

      <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 md:justify-end">
        <RowStat label={t("books")} value={formatNumber(stats.booksCount, locale)} />
        <RowStat label={t("read")} value={formatNumber(stats.readCount, locale)} />
        <RowStat label={t("toBuy")} value={formatNumber(stats.wantToBuyCount, locale)} />
        <RowStat
          label={t("rating")}
          value={
            stats.averageRating === null ? (
              <span className="text-muted-foreground">{tCard("noRatingShort")}</span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <UiIcon aria-hidden className="shrink-0 text-favorite" name="star-fill" size={14} />
                {formatNumber(stats.averageRating, locale, {
                  maximumFractionDigits: 1,
                  minimumFractionDigits: 1,
                })}
                <span className="text-xs font-normal text-muted-foreground">
                  {t("ratingCount", { count: stats.ratedBooksCount })}
                </span>
              </span>
            )
          }
        />
        <RowStat
          label={t("lastAdded")}
          value={
            stats.lastBookAddedAt === null ? (
              <span className="text-muted-foreground">{t("lastAddedNever")}</span>
            ) : (
              formatDate(stats.lastBookAddedAt, locale)
            )
          }
        />
      </dl>

      <UiIcon
        aria-hidden
        className="hidden shrink-0 text-primary transition-transform duration-200 group-hover/publisher-row:translate-x-0.5 md:block"
        name="arrow-right"
        size={18}
      />
    </article>
  );
}

function RowStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-16 flex-col gap-0.5">
      <dt className="text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm font-semibold text-ink tabular-nums">{value}</dd>
    </div>
  );
}
