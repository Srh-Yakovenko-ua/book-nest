import type { BookView } from "@app/shared";

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
