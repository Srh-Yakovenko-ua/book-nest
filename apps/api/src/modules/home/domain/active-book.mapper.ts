import type { HomeActiveBook, Nullable } from "@app/shared";

import { HomeActiveReadingStatusSchema } from "@app/shared";

import type { HomeBookFacts } from "./home-book.mapper.js";

import { toNullableIsoDate } from "../../../core/iso-date.js";
import { resolveActiveBookKey } from "./active-book-order.js";

export type ActiveBookEntry = {
  id: string;
  key: Nullable<string>;
  lastProgressAt: Nullable<string>;
  title: string;
};

export function toActiveBookEntry(row: {
  cycleStartedAt: Nullable<Date>;
  id: string;
  lastProgressAt: Nullable<Date>;
  title: string;
}): ActiveBookEntry {
  const lastProgressAt = toNullableIsoDate(row.lastProgressAt);
  return {
    id: row.id,
    key: resolveActiveBookKey({
      cycleStartedAt: toNullableIsoDate(row.cycleStartedAt),
      lastProgressAt,
    }),
    lastProgressAt,
    title: row.title,
  };
}

export function toHomeActiveBook({
  facts,
  lastProgressAt,
}: {
  facts: HomeBookFacts;
  lastProgressAt: Nullable<string>;
}): Nullable<HomeActiveBook> {
  const readingStatus = HomeActiveReadingStatusSchema.safeParse(facts.readingStatus);
  if (!readingStatus.success) {
    return null;
  }

  return {
    authors: facts.authors,
    cover: facts.cover,
    currentPage: facts.currentPage,
    cycleStartedAt: facts.cycleStartedAt,
    id: facts.id,
    lastProgressAt,
    pagesCount: facts.pagesCount,
    progressPercent: facts.progressPercent,
    readingStatus: readingStatus.data,
    series: facts.series,
    title: facts.title,
  };
}
