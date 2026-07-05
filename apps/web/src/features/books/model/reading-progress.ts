import type { BookView } from "@app/shared";

import { format } from "date-fns";

export const ISO_DATE_FORMAT = "yyyy-MM-dd";
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const READING_CURRENT_PAGE_CEILING = 100000;

export type ReadingProgressSummary = {
  current: number;
  percent: number;
  total: number;
};

export function resolveReadingProgress(book: BookView): null | ReadingProgressSummary {
  const current = book.readingProgress?.currentPage;
  const total = book.pagesCount;
  if (current === null || current === undefined || total === null || total === 0) return null;
  return { current, percent: Math.round((current / total) * 100), total };
}

export function todayIso(): string {
  return format(new Date(), ISO_DATE_FORMAT);
}
