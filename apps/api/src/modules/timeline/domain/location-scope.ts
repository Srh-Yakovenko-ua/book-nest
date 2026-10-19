import type { Nullable } from "@app/shared";

export type BookSeriesLink = Nullable<{
  deletedAt: Nullable<Date>;
  id: string;
  userId: string;
}>;

export type TimelineLocationScope =
  { bookId: string; kind: "book" } | { kind: "series"; seriesId: string; userId: string };

export function resolveLocationScope({
  bookId,
  series,
  userId,
}: {
  bookId: string;
  series: BookSeriesLink;
  userId: string;
}): TimelineLocationScope {
  if (series === null || series.deletedAt !== null || series.userId !== userId) {
    return { bookId, kind: "book" };
  }
  return { kind: "series", seriesId: series.id, userId };
}
