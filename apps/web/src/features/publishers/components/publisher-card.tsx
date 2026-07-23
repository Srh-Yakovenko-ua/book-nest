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
    <article className="group/publisher-card relative flex h-full flex-col gap-3.5 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-card transition-[box-shadow,border-color] duration-200 ease-out focus-within:border-accent-border focus-within:shadow-hover hover:border-accent-border hover:shadow-hover motion-reduce:transition-none">
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
              className="text-ink no-underline transition-colors outline-none group-hover/publisher-card:text-primary after:absolute after:inset-0 focus-visible:text-primary"
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

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        <PublisherStat icon="book" label={t("books", { count: stats.booksCount })} />
        <PublisherStat icon="check-circle" label={t("read", { count: stats.readCount })} />
        <PublisherStat icon="cart" label={t("toBuy", { count: stats.wantToBuyCount })} />
      </ul>

      <div className="flex items-center gap-1.5 text-[0.8125rem]">
        {stats.averageRating === null ? (
          <span className="text-muted-foreground">{t("noRating")}</span>
        ) : (
          <>
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
          </>
        )}
      </div>

      {stats.lastBookAddedAt === null ? null : (
        <p className="flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
          <UiIcon aria-hidden className="shrink-0 text-icon" name="calendar" size={14} />
          {t("lastAdded", { date: formatDate(stats.lastBookAddedAt, locale) })}
        </p>
      )}

      <p className="mt-auto inline-flex items-center gap-1.5 pt-0.5 text-sm font-medium text-primary">
        {t("view")}
        <UiIcon
          aria-hidden
          className="transition-transform duration-200 group-hover/publisher-card:translate-x-0.5"
          name="arrow-right"
          size={15}
        />
      </p>
    </article>
  );
}

function PublisherStat({ icon, label }: { icon: "book" | "cart" | "check-circle"; label: string }) {
  return (
    <li className="inline-flex items-center gap-1.5 text-[0.8125rem] text-foreground/85">
      <UiIcon aria-hidden className="shrink-0 text-icon" name={icon} size={15} />
      <span>{label}</span>
    </li>
  );
}
