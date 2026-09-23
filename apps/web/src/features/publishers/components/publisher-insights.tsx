"use client";

import type { LibraryPublishersSummary } from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";
import { createSerializer } from "nuqs";

import { UiIcon, type UiIconName } from "@/components/icons";
import { MobilePageOverviewLink } from "@/components/ui/mobile-page-overview-panel";
import { LIBRARY_PUBLISHER_PRESENCE_MISSING, libraryQueryParsers } from "@/features/books";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const MISSING_PUBLISHER_BOOKS_HREF = createSerializer(libraryQueryParsers)("/books", {
  publisherPresence: LIBRARY_PUBLISHER_PRESENCE_MISSING,
});

type PublisherInsightsProps = {
  summary: LibraryPublishersSummary;
};

export function hasPublisherInsights(summary: LibraryPublishersSummary | undefined): boolean {
  if (summary === undefined) return false;
  return (
    summary.booksWithoutPublisherCount > 0 ||
    summary.unreadPublishers.length > 0 ||
    summary.bestRatedPublishers.length > 0
  );
}

export function PublisherInsights({ summary }: PublisherInsightsProps) {
  const t = useTranslations("publishers.insights");
  const locale = useLocale();

  return (
    <>
      {summary.booksWithoutPublisherCount > 0 ? (
        <InsightBlock
          icon="alert-triangle"
          iconClassName="text-warning"
          title={t("attention.title")}
        >
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-ink">
              {t("attention.count", { count: summary.booksWithoutPublisherCount })}
            </p>
            <p className="text-xs text-muted-foreground">{t("attention.description")}</p>
          </div>
          <MobilePageOverviewLink
            className="group/insight inline-flex cursor-pointer items-center gap-1.5 self-start rounded-md text-sm font-medium text-primary no-underline transition-colors outline-none hover:text-primary-hover focus-visible:ring-3 focus-visible:ring-ring/50"
            href={MISSING_PUBLISHER_BOOKS_HREF}
          >
            <span className="group-hover/insight:underline">{t("attention.action")}</span>
            <UiIcon
              aria-hidden
              className="transition-transform group-hover/insight:translate-x-0.5"
              name="arrow-right"
              size={15}
            />
          </MobilePageOverviewLink>
        </InsightBlock>
      ) : null}

      {summary.unreadPublishers.length > 0 ? (
        <InsightBlock icon="book-open-text" iconClassName="text-info" title={t("unread.title")}>
          <ul className="-mx-1.5 flex flex-col gap-0.5">
            {summary.unreadPublishers.map((publisher) => (
              <InsightRow
                detail={t("unread.count", { count: publisher.unreadCount })}
                id={publisher.id}
                key={publisher.id}
                name={publisher.name}
              />
            ))}
          </ul>
        </InsightBlock>
      ) : null}

      {summary.bestRatedPublishers.length > 0 ? (
        <InsightBlock icon="star" iconClassName="text-favorite" title={t("bestRated.title")}>
          <ul className="-mx-1.5 flex flex-col gap-0.5">
            {summary.bestRatedPublishers.map((publisher) => (
              <InsightRow
                detail={
                  <span className="inline-flex items-center gap-1">
                    <UiIcon aria-hidden className="text-favorite" name="star-fill" size={12} />
                    <span className="font-medium text-ink">
                      {formatNumber(publisher.averageRating, locale, {
                        maximumFractionDigits: 1,
                        minimumFractionDigits: 1,
                      })}
                    </span>
                    {t("bestRated.ratedCount", { count: publisher.ratedBooksCount })}
                  </span>
                }
                id={publisher.id}
                key={publisher.id}
                name={publisher.name}
              />
            ))}
          </ul>
        </InsightBlock>
      ) : null}
    </>
  );
}

function InsightBlock({
  children,
  icon,
  iconClassName,
  title,
}: {
  children: ReactNode;
  icon: UiIconName;
  iconClassName: string;
  title: string;
}) {
  return (
    <section className="sidebar-card-leaf flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-card">
      <h2 className="flex items-center gap-1.5 font-heading text-sm font-semibold text-ink">
        <UiIcon aria-hidden className={cn("shrink-0", iconClassName)} name={icon} size={16} />
        {title}
      </h2>
      {children}
    </section>
  );
}

function InsightRow({ detail, id, name }: { detail: ReactNode; id: string; name: string }) {
  return (
    <li>
      <MobilePageOverviewLink
        className="flex cursor-pointer flex-col gap-0.5 rounded-md px-1.5 py-1.5 no-underline transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50"
        href={`/publishers/${id}`}
      >
        <span className="truncate text-sm font-medium text-ink">{name}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{detail}</span>
      </MobilePageOverviewLink>
    </li>
  );
}
