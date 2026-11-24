import type { HomeActiveBook, HomeActiveBooksPage, Nullable } from "@app/shared";

import { HOME_DASHBOARD_RULES } from "@app/shared";
import { differenceInCalendarDays, parseISO } from "date-fns";

export type HomeActiveBookProgress =
  | { currentPage: number; kind: "page"; pagesCount: Nullable<number>; percent: Nullable<number> }
  | { kind: "percent"; percent: number }
  | { kind: "unknown" };

export type HomeActiveBookUpdate =
  { daysAgo: number; isStale: boolean; kind: "known" } | { kind: "unknown" };

export type HomeCarouselWindow = {
  canGoNext: boolean;
  canGoPrevious: boolean;
  first: number;
  last: number;
  shouldLoadMore: boolean;
};

const PREFETCH_DISTANCE = 2;

export function activeBookProgress(book: HomeActiveBook): HomeActiveBookProgress {
  const percent = book.progressPercent === null ? null : Math.round(book.progressPercent);
  if (book.currentPage !== null) {
    return { currentPage: book.currentPage, kind: "page", pagesCount: book.pagesCount, percent };
  }
  if (percent !== null) return { kind: "percent", percent };
  return { kind: "unknown" };
}

export function activeBookUpdate({
  lastProgressAt,
  today,
}: {
  lastProgressAt: Nullable<string>;
  today: string;
}): HomeActiveBookUpdate {
  if (lastProgressAt === null) return { kind: "unknown" };
  const daysAgo = Math.max(differenceInCalendarDays(parseISO(today), parseISO(lastProgressAt)), 0);
  return {
    daysAgo,
    isStale: daysAgo >= HOME_DASHBOARD_RULES.activeBooks.staleAfterDays,
    kind: "known",
  };
}

export function clampCarouselIndex({ count, index }: { count: number; index: number }): number {
  if (count === 0) return 0;
  return Math.min(Math.max(index, 0), count - 1);
}

export function homeCarouselWindow({
  count,
  hasMore,
  visible,
}: {
  count: number;
  hasMore: boolean;
  visible: readonly number[];
}): HomeCarouselWindow {
  const inRange = visible.filter((index) => index >= 0 && index < count);
  const first = inRange.length === 0 ? 0 : Math.min(...inRange);
  const last = inRange.length === 0 ? Math.min(count - 1, 0) : Math.max(...inRange);

  return {
    canGoNext: last < count - 1 || hasMore,
    canGoPrevious: first > 0,
    first,
    last,
    shouldLoadMore: hasMore && last >= count - PREFETCH_DISTANCE,
  };
}

export function mergeActiveBookPages(pages: readonly HomeActiveBooksPage[]): HomeActiveBook[] {
  const seen = new Set<string>();
  return pages
    .flatMap((page) => page.items)
    .filter((book) => {
      if (seen.has(book.id)) return false;
      seen.add(book.id);
      return true;
    });
}
