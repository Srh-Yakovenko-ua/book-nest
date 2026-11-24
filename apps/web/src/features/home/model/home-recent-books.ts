import type { BookView } from "@app/shared";

import { compareDesc, differenceInCalendarDays, parseISO } from "date-fns";

import { parseIsoDay } from "@/lib/format";
import { instantToIsoDay } from "@/lib/iso-day";

export type HomeRecentBook = {
  addedDaysAgo: number;
  book: BookView;
};

export type HomeRecentShelf =
  | { books: HomeRecentBook[]; kind: "books" }
  | { kind: "error" }
  | { kind: "hidden" }
  | { kind: "loading" };

type RecentBooksQuery = {
  data: undefined | { recentlyAdded: BookView[] };
  isError: boolean;
};

const HOME_RECENT_BOOKS = {
  limit: 3,
  windowDays: 30,
} as const;

export function homeRecentShelf({
  query,
  timeZone,
  today,
}: {
  query: RecentBooksQuery;
  timeZone: string;
  today: string;
}): HomeRecentShelf {
  if (query.data === undefined) return query.isError ? { kind: "error" } : { kind: "loading" };

  const books = recentBooksInWindow({ books: query.data.recentlyAdded, timeZone, today });
  return books.length === 0 ? { kind: "hidden" } : { books, kind: "books" };
}

export function recentBooksInWindow({
  books,
  timeZone,
  today,
}: {
  books: readonly BookView[];
  timeZone: string;
  today: string;
}): HomeRecentBook[] {
  const todayDate = parseIsoDay(today);

  return books
    .map((book) => ({
      addedDaysAgo: differenceInCalendarDays(
        todayDate,
        parseIsoDay(instantToIsoDay({ instant: book.createdAt, timeZone })),
      ),
      book,
    }))
    .filter(({ addedDaysAgo }) => addedDaysAgo >= 0 && addedDaysAgo < HOME_RECENT_BOOKS.windowDays)
    .sort(
      (left, right) =>
        compareDesc(parseISO(left.book.createdAt), parseISO(right.book.createdAt)) ||
        left.book.id.localeCompare(right.book.id),
    )
    .slice(0, HOME_RECENT_BOOKS.limit);
}
