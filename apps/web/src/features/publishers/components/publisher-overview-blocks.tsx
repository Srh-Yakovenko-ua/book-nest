"use client";

import type {
  LibraryPublisherOverview,
  PublisherOverviewLatestBook,
  PublisherOverviewReadingBook,
  PublisherOverviewReadingProgress,
  PublisherOverviewSeries,
  PublisherOverviewWishlistBook,
  SeriesStatus,
} from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { MobilePageOverviewLink } from "@/components/ui/mobile-page-overview-panel";
import { Progress } from "@/components/ui/progress";
import { formatStorePrice } from "@/features/books-to-buy/model/format-store-price";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type LatestBookBadge = {
  label: string;
  variant: "outline" | "secondary";
};

type PublisherOverviewBlocksProps = {
  overview: LibraryPublisherOverview;
};

const OVERVIEW_BLOCK = {
  cover: "h-16 w-12 rounded-md",
  coverSizes: "48px",
  row: "-mx-1.5 flex cursor-pointer items-start gap-2.5 rounded-md px-1.5 py-1.5 no-underline transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50",
} as const;

const SERIES_STATUS_BADGE_VARIANT = {
  completed: "success",
  ongoing: "info",
  unknown: "secondary",
} as const satisfies Record<SeriesStatus, "info" | "secondary" | "success">;

export function hasPublisherOverviewBlocks(overview: LibraryPublisherOverview): boolean {
  return (
    overview.activeReading.length > 0 ||
    overview.series.length > 0 ||
    overview.wishlist.length > 0 ||
    overview.latestBook !== null
  );
}

export function PublisherOverviewBlocks({ overview }: PublisherOverviewBlocksProps) {
  const t = useTranslations("publishers.details.overview");

  return (
    <>
      {overview.activeReading.length === 0 ? null : (
        <OverviewCard icon="book-open-text" iconClassName="text-info" title={t("sections.reading")}>
          <ul className="flex flex-col gap-1">
            {overview.activeReading.map((book) => (
              <li key={book.id}>
                <ReadingRow book={book} />
              </li>
            ))}
          </ul>
        </OverviewCard>
      )}

      {overview.series.length === 0 ? null : (
        <OverviewCard icon="layers" iconClassName="text-primary" title={t("sections.series")}>
          <ul className="flex flex-col gap-1">
            {overview.series.map((series) => (
              <li key={series.id}>
                <SeriesRow series={series} />
              </li>
            ))}
          </ul>
        </OverviewCard>
      )}

      {overview.wishlist.length === 0 ? null : (
        <OverviewCard icon="cart" iconClassName="text-tag" title={t("sections.wishlist")}>
          <ul className="flex flex-col gap-1">
            {overview.wishlist.map((book) => (
              <li key={book.id}>
                <WishlistRow book={book} />
              </li>
            ))}
          </ul>
        </OverviewCard>
      )}

      {overview.latestBook === null ? null : (
        <OverviewCard icon="sparkles" iconClassName="text-success" title={t("sections.latest")}>
          <LatestRow book={overview.latestBook} />
        </OverviewCard>
      )}
    </>
  );
}

function LatestRow({ book }: { book: PublisherOverviewLatestBook }) {
  const t = useTranslations("publishers.details.overview");
  const locale = useLocale();
  const badge = useLatestBookBadge(book);

  return (
    <OverviewBookRow book={book}>
      <span className="mt-1 flex flex-wrap items-center gap-1.5">
        <Badge variant={badge.variant}>{badge.label}</Badge>
        <span className="text-xs text-muted-foreground">
          {t("addedAt", { date: formatDate(book.createdAt, locale) })}
        </span>
      </span>
    </OverviewBookRow>
  );
}

function OverviewBookRow({
  book,
  children,
  trailing,
}: {
  book: Pick<PublisherOverviewWishlistBook, "authors" | "cover" | "id" | "title">;
  children?: ReactNode;
  trailing?: ReactNode;
}) {
  const authorNames = book.authors.map((author) => author.name).join(", ");

  return (
    <MobilePageOverviewLink className={OVERVIEW_BLOCK.row} href={`/books/${book.id}`}>
      <span
        aria-hidden
        className={cn("relative shrink-0 overflow-hidden bg-accent", OVERVIEW_BLOCK.cover)}
      >
        {book.cover === null ? (
          <span className="grid h-full place-items-center text-accent-foreground/70">
            <UiIcon name="book" size={14} />
          </span>
        ) : (
          <Image
            alt=""
            className="object-cover"
            fill
            sizes={OVERVIEW_BLOCK.coverSizes}
            src={book.cover.urls.thumb}
            unoptimized
          />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="line-clamp-2 text-sm font-medium text-ink">{book.title}</span>
        {authorNames === "" ? null : (
          <span className="truncate text-xs text-muted-foreground">{authorNames}</span>
        )}
        {children}
      </span>
      {trailing === undefined ? null : <span className="shrink-0 text-right">{trailing}</span>}
    </MobilePageOverviewLink>
  );
}

function OverviewCard({
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

function ReadingProgress({ progress }: { progress: PublisherOverviewReadingProgress }) {
  const t = useTranslations("publishers.details.overview");
  const { currentPage, pagesCount } = progress;
  const percent = Math.min(100, Math.round((currentPage / pagesCount) * 100));

  return (
    <span className="mt-1 flex flex-col gap-1">
      <Progress
        aria-label={t("progressAriaLabel", { current: currentPage, total: pagesCount })}
        aria-valuenow={percent}
        className="h-1"
        value={percent}
      />
      <span className="text-xs text-muted-foreground tabular-nums">
        {t("progress", { current: currentPage, total: pagesCount })}
      </span>
    </span>
  );
}

function ReadingRow({ book }: { book: PublisherOverviewReadingBook }) {
  return (
    <OverviewBookRow book={book}>
      {book.progress === null ? null : <ReadingProgress progress={book.progress} />}
    </OverviewBookRow>
  );
}

function SeriesRow({ series }: { series: PublisherOverviewSeries }) {
  const t = useTranslations("publishers.details.overview");
  const tStatus = useTranslations("series.status");

  function readCopy() {
    if (series.readCount === 0) return t("seriesReadNone");
    if (series.readCount >= series.booksCount) return t("seriesReadAll");
    return t("seriesReadSome", { count: series.readCount });
  }

  return (
    <MobilePageOverviewLink
      className={cn(OVERVIEW_BLOCK.row, "items-center")}
      href={`/series/${series.id}`}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="line-clamp-2 text-sm font-medium text-ink">{series.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {`${t("seriesBooks", { count: series.booksCount })} · ${readCopy()}`}
        </span>
      </span>
      <Badge className="shrink-0" variant={SERIES_STATUS_BADGE_VARIANT[series.status]}>
        {tStatus(series.status)}
      </Badge>
    </MobilePageOverviewLink>
  );
}

function useLatestBookBadge(book: PublisherOverviewLatestBook): LatestBookBadge {
  const tOwnership = useTranslations("books.ownershipStatus.options");
  const tReading = useTranslations("books.readingStatus.options");

  if (book.ownershipStatus !== "none" && book.ownershipStatus !== "owned") {
    return { label: tOwnership(book.ownershipStatus), variant: "outline" };
  }
  return { label: tReading(book.readingStatus), variant: "secondary" };
}

function WishlistRow({ book }: { book: PublisherOverviewWishlistBook }) {
  const t = useTranslations("publishers.details.overview");
  const locale = useLocale();

  return (
    <OverviewBookRow
      book={book}
      trailing={
        book.bestOffer === null ? (
          <span className="text-xs text-muted-foreground">{t("noPrice")}</span>
        ) : (
          <span className="text-sm font-semibold whitespace-nowrap text-ink tabular-nums">
            {formatStorePrice({ ...book.bestOffer, locale })}
          </span>
        )
      }
    />
  );
}
