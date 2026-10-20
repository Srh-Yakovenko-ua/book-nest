"use client";

import type { CompletedReadRef } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { RatingScore } from "@/components/ui/rating-score";

import { useAppendedPageFocus } from "../../hooks/use-appended-page-focus";
import { formatDayShort } from "../../model/statistics-format";
import { StatisticsSectionState } from "../statistics-states";
import { CompletedReadDetails } from "./completed-read-details";
import { LoadMore } from "./details-states";
import { StatisticsBookCover } from "./statistics-book-cover";
import { StatisticsDetailSurface } from "./statistics-detail-surface";

type CompletedReadsListPage = { items: readonly CompletedReadRef[]; totalCount: number };

export function CompletedReadsList({
  emptyTitle,
  hasMore,
  isLoadingMore,
  onLoadMore,
  pages,
}: {
  emptyTitle: string;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  pages: readonly CompletedReadsListPage[];
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.details.bucket");
  const tDay = useTranslations("statistics.details.day");
  const tRead = useTranslations("statistics.details.completedRead");
  const { focusRefFor, loadMore } = useAppendedPageFocus({ onLoadMore, pages });

  const reads = pages.flatMap((page) => page.items);
  const totalCount = pages[0]?.totalCount ?? 0;

  if (reads.length === 0) {
    return <StatisticsSectionState kind="empty" title={emptyTitle} />;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">{t("readsTotal", { count: totalCount })}</p>
      <ul className="flex flex-col gap-1">
        {reads.map((read) => (
          <li key={read.readingCycleId}>
            <StatisticsDetailSurface
              detail={() => <CompletedReadDetails read={read} />}
              label={tRead("open", { title: read.book.title })}
              title={read.book.title}
              triggerClassName="flex w-full items-center gap-3 rounded-md p-1 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
              triggerRef={focusRefFor(read)}
            >
              <StatisticsBookCover
                className="w-9 shrink-0"
                coverThumbUrl={read.book.coverThumbUrl}
                title={read.book.title}
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-foreground">
                  {read.book.title}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <time dateTime={read.finishedAt}>{formatDayShort(read.finishedAt, locale)}</time>
                  {read.rating === null ? null : (
                    <RatingScore className="text-xs" value={read.rating} />
                  )}
                </span>
                {read.book.bookState === "soft_deleted" ? (
                  <span className="text-xs text-muted-foreground">{tDay("deletedBook")}</span>
                ) : null}
              </span>
            </StatisticsDetailSurface>
          </li>
        ))}
      </ul>
      <LoadMore hasMore={hasMore} isLoading={isLoadingMore} onLoadMore={loadMore} />
    </div>
  );
}
