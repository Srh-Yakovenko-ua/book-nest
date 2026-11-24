import type { HomeAttentionGroup, Nullable } from "@app/shared";

import { HOME_DASHBOARD_RULES } from "@app/shared";

import { daysBetweenIsoDates } from "../../../core/iso-date.js";

export type StaleReadingCandidate = {
  id: string;
  lastProgressAt: Nullable<string>;
  title: string;
};

const SINGLE_BOOK = 1;

export function buildReadingStaleAttention({
  books,
  today,
}: {
  books: readonly StaleReadingCandidate[];
  today: string;
}): HomeAttentionGroup[] {
  const stale = books.filter((book) => isStale({ lastProgressAt: book.lastProgressAt, today }));
  const [first] = stale;
  if (first === undefined) {
    return [];
  }

  const isSingle = stale.length === SINGLE_BOOK;
  return [
    {
      bookId: isSingle ? first.id : null,
      bookTitle: isSingle ? first.title : null,
      count: stale.length,
      dueDate: null,
      id: "reading_stale",
      reason: "reading_stale",
      severity: "low",
      unit: "books",
    },
  ];
}

export function isStale({
  lastProgressAt,
  today,
}: {
  lastProgressAt: Nullable<string>;
  today: string;
}): boolean {
  if (lastProgressAt === null) {
    return false;
  }
  return (
    daysBetweenIsoDates({ endIsoDate: today, startIsoDate: lastProgressAt }) >=
    HOME_DASHBOARD_RULES.activeBooks.staleAfterDays
  );
}
